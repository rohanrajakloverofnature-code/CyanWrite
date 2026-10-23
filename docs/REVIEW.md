# CyanWrite review history

## 1.2.2 / version code 7

### Verified

- All 83 JavaScript tests pass as of this review. These cover the shared resolver and validation paths for analysis, translation, connection test, native transport, and generic server model validation, including default/manual selection and legacy model handling.
- Automatic/app-default model selection uses Gemini `gemini-3.8-flash`, OpenAI `gpt-4o-mini`, and DeepSeek `deepseek-flash`. The Gemini default is documented by the [official Gemini model documentation](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash).
- A blank saved override uses the provider default. Legacy numeric entry `2` is repaired to Automatic with a visible notice; newly entered numeric overrides are rejected before transport; valid old overrides remain selected. Older Gemini `models/` prefixes are normalized.

### Boundaries and pending verification

- 25 model-selection browser checks and 18 DeepSeek browser checks passed with mocked providers; five of five resource-aware Android tests passed; and `assembleDebug` plus `lintDebug` succeeded with six warnings and zero errors. These checks do not prove a physical-device or emulator WebView install or live-provider quality. No real key or billable request was used.
- Automatic is default selection, not model discovery, availability probing, fallback, or retry. Anthropic and custom providers remain manual-only with an exact model ID; no discovery or fallback is promised.
- Provider account access, billing limits, API capability, response schema, network behavior, and model availability remain external constraints. Web direct calls require provider CORS support. Android uses the native HTTPS transport but cannot overcome unsupported provider/account/schema or platform limits. Keys are session-only.
- Final clean APK packaging was still in progress to exclude temporary local test-harness assets. No public publishing or deployment was performed.

## 1.2.1 history

Version 1.2.1 added eight DeepSeek-specific mocked tests (73 JavaScript tests total), including both models, exact endpoint/authentication, validated suggestions, translation, safe errors, cancellation, endpoint guards and the native transport bridge. Five resource-aware Android tests passed; debug assembly and lint succeeded. A local Chromium session passed 18 DeepSeek shared-UI checks using the main-world mock harness in `tests/browser-deepseek-review.js`. The browser evaluation bridge runs in an isolated world, so replacing its `window.fetch` is not a valid app-page mock. No real key was used.

## 1.2.0 history

The 1.2.0 release passed 65 JavaScript tests, five resource-aware Android startup/export tests, Android debug assembly and lint. A real browser session passed 13 shared-UI checks: manual-only requests, analysis plus translation, result rendering, mother-tongue prompt, key privacy, authentication errors, local fallback, key clearing, spelling/grammar Apply, and Undo. Provider responses in these tests were mocked; no paid model was used for validation.

## Earlier 1.1.2 review

The shared web/Android offline core provided supported completed-sentence rewrites by selected structure and writing mode, and a bounded local rule-pattern learning ledger. This superseded the earlier prototype review.

- 40 Node regression tests passed, covering local correctness, full-sentence structure alternatives, cause/effect direction, every writing mode, unfinished sentences, abbreviations/decimals/quotes/contractions, legal modal protection, exact offsets, feature flags, learning aggregation/deduplication, and optional-provider consent/security with a mock server.
- Browser end-to-end covered an unfinished-sentence boundary, a Formal + Compound causal rewrite, applying a full-sentence replacement, learning observations and decisions, reload persistence, paused learning, and a supported comma-splice repair.
- Browser service worker registration and the complete application-shell cache were present. Full offline navigation with an externally disabled network was not simulated.
- Android Gradle debug build and lint succeeded (six non-blocking lint warnings). Five resource-aware Robolectric tests passed: cold start and recreation on API 28 and 35, plus safe handling of unsupported export APIs on API 28. Robolectric did not execute a real Chromium renderer; no successful physical-phone or emulator launch was claimed. Shared web assets were checked against the final APK.
- The replacement temporary HTTPS preview responded successfully in that browser. This did not prove accessibility on the owner's Android phone or guarantee permanent availability.

The deterministic rule set handles selected patterns, not arbitrary English. It is not a trained personal language model or comprehensive grammar checker. Mother-tongue explanations, universal translation and open-ended AI need an independently configured capable model. A keyless loopback local-model adapter exists and was mock-tested; no real model was installed or validated.

The free core has no API fees, and no paid service was provisioned. Local-model hardware/electricity and stable hosting are separate considerations. Never promise unlimited, error-free, zero-cost AI.

The old Cloudflare URL came from an anonymous temporary account with a 60-minute claim window. It was unavailable from that environment; the exact provider-side cause of the owner's SSL error remained unconfirmed. No public GitHub repository was created. Permanent owner-controlled deployment and public-source publication still need the appropriate account and exact publication approval.
