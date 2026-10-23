# DeepSeek connection fix — 1.2.3 review

## What was wrong

CyanWrite 1.2.2 blindly appended `/chat/completions` to the saved API base address. Pasting the full endpoint `https://api.deepseek.com/chat/completions` therefore sent a request to `https://api.deepseek.com/chat/completions/chat/completions`. Pasting the full `/v1/chat/completions` endpoint duplicated the suffix in the same way. Unsupported official paths such as `/anthropic` and `/models` were also accepted. The saved address survives closing and reopening the app, so a bad address continued to fail after replacing the key.

This is a proven URL-construction defect, not a proven explanation of the particular screenshot: the screenshot does not show the saved address, actual request URL, or server response headers. HTTP 405 means the responding server rejected the request method for that route; it does not establish that the key or model was invalid. We cannot honestly identify the exact remote route that produced that screenshot from the available evidence.

The default model `deepseek-flash` and the default root endpoint were already correct according to [DeepSeek’s official Chat Completions documentation](https://api-docs.deepseek.com/api/create-chat-completion/) and [setup guide](https://api-docs.deepseek.com/). No speculative model change, fallback, retry, or extra model probe was added.

## Exact requests on web and Android

| Action | Shared entry point | HTTP method | Official default URL |
| --- | --- | --- | --- |
| Test connection | `requestAI`, analyze task, fixed sample `This is a connection test.` | POST | `https://api.deepseek.com/chat/completions` |
| Check writing | `requestAI`, analyze task, current draft | POST | `https://api.deepseek.com/chat/completions` |
| Translation | `requestAI`, translate task, current draft | POST | `https://api.deepseek.com/chat/completions` |

All three use Bearer authorization in a header, JSON bodies, the resolved model, and `response_format: {"type":"json_object"}`. Analysis and translation remain separate potentially billable requests when explicitly requested; Test connection is also a potentially billable sample request in normal use.

On the web, `web/ai.js` calls browser fetch with `method: 'POST'` and `redirect: 'error'`. The browser may issue a CORS OPTIONS preflight before POST; Android native HTTPS does not. A browser preflight rejection normally appears as a connection/CORS failure rather than the app reading a 405 response. This work did not change CORS policy or bypass browser security.

On Android, `web/native-ai.js` forwards the same final URL, headers, and body to `CyanAndroid.requestAI`. The Java bridge explicitly sets `HttpsURLConnection.setRequestMethod("POST")`, disables redirects, and writes UTF-8 JSON. There was no discovered native GET bug. The bridge signature does not carry a method argument: its contract is POST-only. A small extraction now lets unit tests exercise the same native connection configuration used by production code.

The alternative configured-server mode is separate: the app posts to `/api/analyze` and `/api/translate` on its chosen CyanWrite service. It is not used by direct personal-key DeepSeek mode.

## What changed

The shared endpoint resolver accepts DeepSeek root and `/v1` base URLs, their trailing-slash forms, and complete `/chat/completions` or `/v1/chat/completions` URLs. It appends the suffix exactly once and preserves the optional `/v1` prefix. It rejects other paths and nondefault ports on `api.deepseek.com` before sending the key. Existing custom provider-host behavior is retained. Existing HTTPS, credential, query, and fragment validation is retained.

Preferences now shows the resolved `Request: POST …` target, including on startup with saved settings. A 405 explains the POST rejection, gives the correct DeepSeek API addresses, makes no key/model diagnosis, and does not expose provider bodies or keys. No automatic retry occurs. Changing an API address still clears the session key; normalization does not persist or export a key.

Version 1.2.3 uses Android version code 8 and a new web shell cache name. The existing application ID and debug signing identity are retained for this review build. Public publication and release creation are withheld pending approval of the exact APK and source archive.

## Verification

The new routing suite failed five of eight tests before the fix and passes eight of eight afterward. The complete JavaScript suite passes 91/91 tests. Cases cover both transports and tasks, full URL normalization, root and `/v1`, invalid official paths, safe 405 messages, and no retry.

The real browser passed 37 assertions with mocked fetch and 37 with a mocked Android bridge, including the actual shared UI Test connection, Check writing, and translation controls. This proves UI/bridge routing, not a physical Android WebView. Native Robolectric tests separately verify actual Java POST configuration with a fake HTTPS connection for both endpoint paths and three sample/analysis/translation bodies; five existing startup/export tests also pass. Clean `assembleDebug`, `testDebugUnitTest`, and `lintDebug` succeeded: zero errors, six lint warnings. All 14 bundled web assets match the source byte-for-byte, and no test hooks are included in the APK. The signature matches the previous 1.2.2 review APK.

No screenshot key was read or used, no real key was requested, and no paid model generation was made. Unauthenticated empty-body POST probes returned 401 even on malformed paths, so they cannot attribute the screenshot’s 405 or validate live account access. Provider behavior with a real account and physical-device installation remain untested.

To repeat deterministic tests:

```sh
npm test
cd android
JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew --no-daemon assembleDebug testDebugUnitTest lintDebug
```

For the local mock-only browser harness, run `node tests/browser-routing-server.mjs` from the project root, open `http://127.0.0.1:8794/web/`, then `/web/?native=1`. Read `document.documentElement.dataset.routingReview` in browser developer tools. Test assets are outside `web/` and are not bundled in the APK.
