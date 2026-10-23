package app.cyanwrite;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.io.ByteArrayOutputStream;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.Principal;
import java.security.cert.Certificate;
import java.util.Arrays;
import java.util.List;
import javax.net.ssl.HttpsURLConnection;
import javax.net.ssl.SSLPeerUnverifiedException;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;

/** Verifies the native shared transport without opening a socket or using a key. */
@RunWith(RobolectricTestRunner.class)
@Config(sdk = 35)
public class NativeAiHttpTest {
    private static final List<String> TARGETS = Arrays.asList(
        "https://api.deepseek.com/chat/completions",
        "https://api.deepseek.com/v1/chat/completions");

    private static final List<String> BODIES = Arrays.asList(
        "{\"model\":\"deepseek-flash\",\"messages\":[{\"role\":\"user\",\"content\":\"This is a connection test.\"}]}",
        "{\"model\":\"deepseek-flash\",\"messages\":[{\"role\":\"user\",\"content\":\"Analyze: Their café is ready — 你好.\"}]}",
        "{\"model\":\"deepseek-flash\",\"messages\":[{\"role\":\"user\",\"content\":\"Translate the entire text into Hindi: résumé\"}]}");

    @Test public void postsUnchangedUtf8BodiesToBothDeepSeekPaths() throws Exception {
        for (String target : TARGETS) {
            for (String body : BODIES) {
                FakeHttpsURLConnection connection = new FakeHttpsURLConnection(new URL(target));
                JSONObject headers = new JSONObject();
                headers.put("Content-Type", "application/json");
                headers.put("Authorization", "Bearer test-only");

                MainActivity.configureAIConnection(connection, headers, body);

                assertEquals(target, connection.getURL().toString());
                assertFalse(connection.followRedirects);
                assertEquals(20_000, connection.connectTimeout);
                assertEquals(20_000, connection.readTimeout);
                assertEquals("POST", connection.method);
                assertTrue(connection.doOutput);
                assertEquals("application/json", connection.getRequestProperty("Content-Type"));
                assertEquals("Bearer test-only", connection.getRequestProperty("Authorization"));
                assertArrayEquals(body.getBytes(StandardCharsets.UTF_8), connection.output.toByteArray());
            }
        }
    }

    private static final class FakeHttpsURLConnection extends HttpsURLConnection {
        private final ByteArrayOutputStream output = new ByteArrayOutputStream();
        private boolean followRedirects;
        private int connectTimeout;
        private int readTimeout;
        private String method;
        private boolean doOutput;

        FakeHttpsURLConnection(URL url) { super(url); }

        @Override public void setInstanceFollowRedirects(boolean followRedirects) { this.followRedirects = followRedirects; }
        @Override public boolean getInstanceFollowRedirects() { return followRedirects; }
        @Override public void setConnectTimeout(int timeout) { connectTimeout = timeout; }
        @Override public int getConnectTimeout() { return connectTimeout; }
        @Override public void setReadTimeout(int timeout) { readTimeout = timeout; }
        @Override public int getReadTimeout() { return readTimeout; }
        @Override public void setRequestMethod(String method) { this.method = method; }
        @Override public String getRequestMethod() { return method; }
        @Override public void setDoOutput(boolean doOutput) { this.doOutput = doOutput; }
        @Override public boolean getDoOutput() { return doOutput; }
        @Override public java.io.OutputStream getOutputStream() { return output; }
        @Override public void connect() { connected = true; }
        @Override public void disconnect() { connected = false; }
        @Override public boolean usingProxy() { return false; }
        @Override public String getCipherSuite() { return null; }
        @Override public Certificate[] getLocalCertificates() { return null; }
        @Override public Certificate[] getServerCertificates() throws SSLPeerUnverifiedException { return null; }
        @Override public Principal getPeerPrincipal() throws SSLPeerUnverifiedException { return null; }
        @Override public Principal getLocalPrincipal() { return null; }
    }
}
