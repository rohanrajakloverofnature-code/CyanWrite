package app.cyanwrite;

import static org.junit.Assert.*;

import android.os.Looper;
import android.view.View;
import android.webkit.WebView;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.Shadows;
import org.robolectric.android.controller.ActivityController;
import org.robolectric.annotation.Config;

/** Runs the real manifest/theme/activity, rather than only testing shared JavaScript. */
@RunWith(RobolectricTestRunner.class)
@Config(sdk = {28, 35})
public class MainActivityStartupTest {
    private static final String HOME = "https://appassets.androidplatform.net/assets/index.html";

    @Test public void coldStartReachesBundledEditor() {
        try (ActivityController<MainActivity> controller = Robolectric.buildActivity(MainActivity.class).setup()) {
            MainActivity activity = controller.get();
            View content = activity.findViewById(android.R.id.content);
            assertNotNull(content);
            WebView webView = (WebView) ((android.view.ViewGroup) content).getChildAt(0);
            assertEquals(HOME, Shadows.shadowOf(webView).getLastLoadedUrl());
            assertTrue(webView.getSettings().getJavaScriptEnabled());
            assertTrue(webView.getSettings().getDomStorageEnabled());
            assertFalse(webView.getSettings().getAllowFileAccess());
            assertFalse(activity.isFinishing());
        }
    }

    @Test public void recreationReachesBundledEditor() {
        try (ActivityController<MainActivity> controller = Robolectric.buildActivity(MainActivity.class).setup()) {
            controller.recreate();
            Shadows.shadowOf(Looper.getMainLooper()).idle();
            MainActivity activity = controller.get();
            WebView webView = (WebView) ((android.view.ViewGroup) activity.findViewById(android.R.id.content)).getChildAt(0);
            assertEquals(HOME, Shadows.shadowOf(webView).getLastLoadedUrl());
            assertFalse(activity.isFinishing());
        }
    }

    @Test @Config(sdk = 28) public void oldAndroidExportShowsExplanationInsteadOfCrashing() {
        try (ActivityController<MainActivity> controller = Robolectric.buildActivity(MainActivity.class).setup()) {
            MainActivity activity = controller.get();
            activity.new AndroidBridge().saveText("draft.txt", "text/plain", "A saved draft.");
            Shadows.shadowOf(Looper.getMainLooper()).idle();
            assertEquals("File export requires Android 10 or newer. Your draft remains in the app.",
                org.robolectric.shadows.ShadowToast.getTextOfLatestToast());
            assertFalse(activity.isFinishing());
        }
    }
}
