package app.cyanwrite;

import android.app.*;
import android.content.*;
import android.database.Cursor;
import android.net.Uri;
import android.os.*;
import android.provider.MediaStore;
import android.webkit.*;
import android.view.*;
import android.widget.Toast;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.webkit.WebViewAssetLoader;
import java.io.*;
import java.net.InetAddress;
import java.net.URI;
import java.net.URL;
import java.net.HttpURLConnection;
import java.util.Map;
import java.util.HashMap;
import java.util.Locale;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import javax.net.ssl.HttpsURLConnection;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

public class MainActivity extends AppCompatActivity {
    private static final int FILE_CHOOSER = 42;
    private ValueCallback<Uri[]> pendingFiles;
    private WebView webView;
    private AndroidBridge androidBridge;
    private static final String APP_ORIGIN = "https://appassets.androidplatform.net";
    private final ExecutorService aiExecutor = Executors.newFixedThreadPool(4);

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        webView = new WebView(this);
        setContentView(webView);
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this)).build();
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true); s.setDomStorageEnabled(true); s.setAllowFileAccess(false);
        s.setAllowContentAccess(false); s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setBuiltInZoomControls(false); s.setSupportZoom(false);
        androidBridge = new AndroidBridge();
        webView.addJavascriptInterface(androidBridge, "CyanAndroid");
        webView.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) { return loader.shouldInterceptRequest(r.getUrl()); }
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                if (APP_ORIGIN.equals(u.getScheme()+"://"+u.getHost())) return false;
                if ("https".equalsIgnoreCase(u.getScheme()) || "http".equalsIgnoreCase(u.getScheme())) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) { }
                }
                return true;
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams p) {
                if (pendingFiles != null) pendingFiles.onReceiveValue(null); pendingFiles = cb;
                Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT); i.addCategory(Intent.CATEGORY_OPENABLE); i.setType("text/csv");
                i.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"text/csv", "application/csv", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel"});
                startActivityForResult(i, FILE_CHOOSER); return true;
            }
        });
        webView.setDownloadListener((url, userAgent, contentDisposition, mime, length) -> {
            if (url != null && (url.startsWith("https://") || url.startsWith("http://"))) {
                try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); } catch (Exception ignored) { }
            }
        });
        webView.loadUrl(APP_ORIGIN + "/assets/index.html");
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, @Nullable Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILE_CHOOSER && pendingFiles != null) {
            Uri[] result = resultCode == RESULT_OK && data != null && data.getData() != null ? new Uri[]{data.getData()} : null;
            pendingFiles.onReceiveValue(result); pendingFiles = null;
        }
    }
    @Override public void onBackPressed() { if (webView.canGoBack()) webView.goBack(); else super.onBackPressed(); }

    @Override protected void onDestroy() {
        if (androidBridge != null) androidBridge.cancelAll();
        aiExecutor.shutdownNow();
        super.onDestroy();
    }

    public final class AndroidBridge {
        private static final int MAX_BODY_CHARS = 200_000;
        private static final int MAX_RESPONSE_BYTES = 500_000;
        private static final int MAX_IN_FLIGHT = 4;
        private final Map<String, AiRequest> requests = new HashMap<>();

        private final class AiRequest {
            final AtomicBoolean cancelled = new AtomicBoolean(false);
            volatile HttpsURLConnection connection;
            volatile Future<?> future;
        }

        @JavascriptInterface public void requestAI(String id, String url, String headersJson, String body) {
            if (id == null || id.length() == 0 || id.length() > 2_000 || body == null || body.length() > MAX_BODY_CHARS) {
                postAIReply(id, 0, "AI request failed.");
                return;
            }
            final URI target;
            final JSONObject headers;
            try {
                target = validateTarget(url);
                headers = headersJson == null || headersJson.length() == 0 ? new JSONObject() : new JSONObject(headersJson);
                validateHeaders(headers);
            } catch (Exception ignored) {
                postAIReply(id, 0, "AI request failed.");
                return;
            }
            final AiRequest request = new AiRequest();
            synchronized (requests) {
                if (!requests.containsKey(id) && requests.size() >= MAX_IN_FLIGHT) {
                    postAIReply(id, 0, "AI request failed.");
                    return;
                }
                AiRequest old = requests.put(id, request);
                if (old != null) cancelRequest(old);
            }
            try {
                request.future = aiExecutor.submit(() -> performAI(id, target, headers, body, request));
            } catch (RejectedExecutionException ignored) {
                synchronized (requests) {
                    if (requests.get(id) == request) requests.remove(id);
                }
                postAIReply(id, 0, "AI request failed.");
            }
        }

        @JavascriptInterface public void cancelAI(String id) {
            if (id == null) return;
            synchronized (requests) {
                AiRequest request = requests.remove(id);
                if (request != null) cancelRequest(request);
            }
        }

        private void cancelAll() {
            synchronized (requests) {
                for (AiRequest request : requests.values()) cancelRequest(request);
                requests.clear();
            }
        }

        private void cancelRequest(AiRequest request) {
            request.cancelled.set(true);
            HttpsURLConnection connection = request.connection;
            if (connection != null) connection.disconnect();
            Future<?> future = request.future;
            if (future != null) future.cancel(true);
        }

        private void performAI(String id, URI target, JSONObject headers, String body, AiRequest request) {
            int status = 0;
            String response = "AI request failed.";
            try {
                // Resolve every address before connecting, rejecting local/private destinations.
                for (InetAddress address : InetAddress.getAllByName(target.getHost())) {
                    if (isBlockedAddress(address)) throw new IOException("blocked destination");
                }
                if (request.cancelled.get()) return;
                HttpsURLConnection connection = (HttpsURLConnection) new URL(target.toString()).openConnection();
                request.connection = connection;
                connection.setInstanceFollowRedirects(false);
                connection.setConnectTimeout(20_000);
                connection.setReadTimeout(20_000);
                connection.setRequestMethod("POST");
                connection.setDoOutput(true);
                java.util.Iterator<String> names = headers.keys();
                while (names.hasNext()) {
                    String name = names.next();
                    connection.setRequestProperty(name, headers.getString(name));
                }
                byte[] payload = body.getBytes(java.nio.charset.StandardCharsets.UTF_8);
                try (OutputStream output = connection.getOutputStream()) { output.write(payload); }
                if (request.cancelled.get()) return;
                status = connection.getResponseCode();
                InputStream stream = status >= 400 ? connection.getErrorStream() : connection.getInputStream();
                response = readResponse(stream, request);
            } catch (Exception ignored) {
                if (request.cancelled.get()) return;
                status = 0;
                response = "AI request failed.";
            } finally {
                HttpsURLConnection connection = request.connection;
                if (connection != null) connection.disconnect();
                synchronized (requests) {
                    if (requests.get(id) == request) requests.remove(id);
                }
            }
            if (!request.cancelled.get()) postAIReply(id, status, response);
        }

        private String readResponse(InputStream stream, AiRequest request) throws IOException {
            if (stream == null) return "";
            try (InputStream input = stream; ByteArrayOutputStream output = new ByteArrayOutputStream()) {
                byte[] buffer = new byte[8192];
                int total = 0;
                int count;
                while ((count = input.read(buffer)) != -1) {
                    if (request.cancelled.get()) return "";
                    if (count > MAX_RESPONSE_BYTES - total) throw new IOException("response too large");
                    output.write(buffer, 0, count); total += count;
                }
                return output.toString(java.nio.charset.StandardCharsets.UTF_8.name());
            }
        }

        private URI validateTarget(String raw) throws Exception {
            if (raw == null) throw new IllegalArgumentException();
            URI uri = new URI(raw);
            if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null || uri.getUserInfo() != null || uri.getFragment() != null || uri.getQuery() != null) throw new IllegalArgumentException();
            return uri;
        }

        private void validateHeaders(JSONObject headers) throws JSONException {
            java.util.Iterator<String> names = headers.keys();
            while (names.hasNext()) {
                String name = names.next();
                if (!(name.equals("Content-Type") || name.equals("Authorization") || name.equals("x-api-key") || name.equals("x-goog-api-key") || name.equals("anthropic-version") || name.equals("anthropic-dangerous-direct-browser-access"))) throw new IllegalArgumentException();
                String value = headers.getString(name);
                if (value.indexOf('\r') >= 0 || value.indexOf('\n') >= 0 || value.length() > 20_000) throw new IllegalArgumentException();
            }
        }

        private boolean isBlockedAddress(InetAddress address) {
            byte[] bytes = address.getAddress();
            if (address.isAnyLocalAddress() || address.isLoopbackAddress() || address.isLinkLocalAddress() || address.isSiteLocalAddress() || address.isMulticastAddress()) return true;
            if (bytes.length == 4) {
                int a = bytes[0] & 255, b = bytes[1] & 255;
                return a == 0 || a == 10 || a == 127 || (a == 169 && b == 254) || (a == 172 && b >= 16 && b <= 31) || (a == 192 && b == 168);
            }
            return (bytes[0] & 255) == 0xfc || (bytes[0] & 255) == 0xfd;
        }

        private void postAIReply(String id, int status, String response) {
            if (id == null || response == null) return;
            runOnUiThread(() -> {
                if (webView == null) return;
                Uri page = Uri.parse(webView.getUrl() == null ? "" : webView.getUrl());
                String path = page.getPath();
                if (!APP_ORIGIN.equals(page.getScheme() + "://" + page.getHost()) || page.getPort() != -1 || page.getUserInfo() != null || path == null || !path.startsWith("/assets/")) return;
                webView.evaluateJavascript("window.__cyanAIReply(" + JSONObject.quote(id) + "," + status + "," + JSONObject.quote(response) + ")", null);
            });
        }

        @JavascriptInterface public void saveText(String filename, String mime, String contents) {
            if (filename == null || contents == null || filename.length() > 180 || contents.length() > 15_000_000) return;
            String safe = filename.replaceAll("[^A-Za-z0-9._-]", "_");
            if (safe.isEmpty() || safe.equals(".") || safe.equals("..")) safe = "draft.txt";
            String lower = safe.toLowerCase(Locale.US);
            if (!(lower.endsWith(".txt") || lower.endsWith(".md") || lower.endsWith(".csv") || lower.endsWith(".xlsx") || lower.endsWith(".json"))) return;
            String type = (mime == null || mime.length() > 120) ? "text/plain" : mime.replaceAll("[^A-Za-z0-9.+/-]", "");
            // Downloads collection was introduced in Android 10; never crash older phones.
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
                runOnUiThread(() -> Toast.makeText(MainActivity.this,
                    "File export requires Android 10 or newer. Your draft remains in the app.",
                    Toast.LENGTH_LONG).show());
                return;
            }
            ContentValues values = new ContentValues(); values.put(MediaStore.Downloads.DISPLAY_NAME, safe); values.put(MediaStore.Downloads.MIME_TYPE, type); values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/CyanWrite");
            Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
            if (uri == null) return;
            try (OutputStream out = getContentResolver().openOutputStream(uri)) { out.write(contents.getBytes(java.nio.charset.StandardCharsets.UTF_8)); runOnUiThread(() -> Toast.makeText(MainActivity.this, "Saved to Downloads/CyanWrite", Toast.LENGTH_SHORT).show()); }
            catch (Exception e) { getContentResolver().delete(uri, null, null); }
        }
    }
}
