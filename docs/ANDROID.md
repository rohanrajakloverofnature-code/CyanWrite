# CyanWrite Android

This is a thin Android host for the shared CyanWrite web app. The app bundles `/workspace/cyanwrite/web` as Android assets at build time; it does **not** duplicate or edit web code. Rebuild after the web app changes so the APK includes the latest files.

## Build

```bash
cd /workspace/cyanwrite/android
./gradlew assembleDebug
# app/build/outputs/apk/debug/app-debug.apk
```

`local.properties` points at the machine Android SDK and is local-only. No signing keys or secrets are included.

## Parity and native boundary

- The first page is loaded from `https://appassets.androidplatform.net/assets/index.html` through `WebViewAssetLoader`, with JavaScript and DOM storage enabled.
- The web app remains the source of truth for editor state, UI, service-base configuration, and export formatting. Android only supplies the WebView shell, file chooser, and download sink.
- The frontend may feature-detect `window.CyanAndroid?.saveText(filename, mime, contents)` for text/CSV/Markdown/JSON/XLSX-compatible exports. The bridge validates names, MIME length, size, extensions, and writes only to `Downloads/CyanWrite` using `MediaStore`; it is not a general filesystem API.
- File inputs open the system document picker for CSV/XLS/XLSX MIME types. Input URI permissions remain managed by Android.
- `appassets.androidplatform.net` navigation is kept in-app. HTTP(S) links leave for the external browser; untrusted navigation is blocked. Mixed content, file access, and content access are disabled. Cleartext HTTP is disabled. `INTERNET` is declared so the frontend can call its explicitly configured HTTPS backend; CORS remains a backend/web concern.
- A normal web `Blob` download should use the bridge when running in Android (`if (window.CyanAndroid) ...`); browsers can continue using the existing anchor download path.

## Verification

Run `./gradlew testDebugUnitTest assembleDebug lintDebug`. Version 1.1.2 (code 4) fixes the splash-screen crash by replacing the platform-only theme with `Theme.AppCompat.Light.NoActionBar`, as required by `AppCompatActivity`. The original theme reproduced `IllegalStateException: You need to use a Theme.AppCompat theme (or descendant) with this activity.` before the editor URL loaded.

Resource-aware Robolectric tests cover cold start and activity recreation on API 28 and 35. They verify activity initialization and the requested bundled editor URL, not actual Chromium rendering. No physical-device or emulator test is claimed. The original four startup cases failed before the theme repair and passed after it.

A separate API 28 test verifies the export compatibility guard: direct MediaStore Downloads export requires Android 10 or newer. Older Android versions now show an explanation instead of calling unavailable APIs; older-Android export support is not implemented. The APK keeps its application ID and debug signing certificate to allow an in-place update from version 1.1.1.
