# CyanWrite 1.2.2

A local-first English writing studio for web and Android. Both use the same bundled HTML, CSS, JavaScript and sentence engine. No account, API key, subscription, or per-request payment is required for the offline core.

## Start

```sh
npm test
node server/server.mjs
# Open http://127.0.0.1:8787
```

Node.js 20+ is enough; the local server has no npm dependencies. Alternatively host `web/` on a static HTTPS host. Opening `index.html` as a `file:` URL is not supported because the app uses ES modules.

## Whole-sentence suggestions

Choose **Simple**, **Complex**, **Compound**, or **Best automatic**. Missing or invalid selections use Best automatic. Supported rewrites appear only after sentence-ending punctuation; unfinished tails are not structurally rewritten. Questions and exclamations are not converted into assertions. Automatic mode leaves already reasonable structures alone rather than manufacturing changes.

The offline engine handles selected causal, concessive, coordinated-clause and comma-splice patterns. Suggestions replace complete sentences, preserve supported cause/effect relationships, and include enabled safe local correctness fixes. Simple mode may replace one sentence with two simple sentences, retaining relationship markers such as “As a result.” A sentence already in the selected structure may not need another suggestion. Unsupported long sentences receive an honest review prompt, not a fabricated rewrite.

**Writing modes:** Normal, Administrative, Legal, Formal, Business, Literary and High standards. Each conditions supported wording changes; High standards combines selected concision, formal and administrative wording rules, not every register indiscriminately. Correct spelling and grammar do not change with register. Legal mode protects modal/conditional obligations from structural changes. It is not legal advice.

No change is applied without your action. Offered replacements and exact offsets are validated. Apply and one-step undo are supported.

## Your recurring patterns

Writing insights stores specific rule observations, accepted and dismissed decisions, short before/after examples, mode/structure contexts, and explanatory practice advice. Different sentences with the same structural pattern are grouped together. Repeated identical checks do not repeatedly count the same observation. Detected suggestions are not confirmed mistakes; style choices are not grammar errors. This is an explicit rule-pattern ledger, not a trained personal language model or a diagnostic English assessment.

Learning can be paused, exported as JSON, or deleted. The ledger is bounded (up to 200 patterns, 500 decisions, 1,200 recent deduplication keys and five short examples per pattern). Trimming may eventually allow an old observation to be counted again. Moving wording to another position can count as another observation. Counts are descriptive, not scientific mistake rates. Browser and APK data are separate and are not automatically synchronized. Older accepted corrections are retained as legacy observations without pretending their original rule/context is known.

## Web and Android

The website can cache its application shell after a successful HTTPS visit. Browser storage can be cleared or evicted, so caching is not a permanent-hosting guarantee. No draft, learning record or AI response is cached by the service worker. The APK bundles the same core assets and does not depend on a live preview address.

Build:

```sh
cd android
JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew --no-daemon assembleDebug testDebugUnitTest
```

Version 1.2.2, version code 7. Optional personal-key AI setup is described in `docs/BYOK.md`. This is a debug-signed review build, not a store release. Current verification includes 83/83 JavaScript tests, 25 model-selection browser checks and 18 DeepSeek browser checks with mocked providers, five of five resource-aware Android tests, and successful `assembleDebug` plus `lintDebug` (six warnings, zero errors). These checks do not run a physical-device or emulator WebView renderer and do not validate live-provider quality; no such result is claimed. A compatible, current Android System WebView is required. Direct Android file export requires Android 10 or newer; older versions show an explanation rather than invoking unavailable Downloads APIs.

The old anonymous Cloudflare preview was temporary and is not a durable deployment. Its exact provider-side failure is unconfirmed. Use an owner-controlled static host for a permanent address. Do not create another anonymous deployment and describe it as permanent.

## Other existing features

Cyan/light/dark responsive UI; local draft saving; text export; feature toggles; CSV/XLSX vocabulary import; vocabulary review; consent-gated optional AI. Google Sheets import is by downloaded CSV, not live OAuth sync. The bundled SheetJS Community Edition parser has its Apache 2.0 license under `web/vendor/`.

## Optional AI with your own key

In Preferences, choose **Automatic / app default** or **Manual** model selection. Defaults are Gemini `gemini-3.8-flash`, OpenAI `gpt-4o-mini`, and DeepSeek `deepseek-flash`; the [official Gemini model documentation](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash) documents the Gemini default. Anthropic and custom providers remain manual-only and require an exact model ID. A blank saved override uses the default; `models/` Gemini prefixes are normalized. Legacy numeric entry `2` is repaired to Automatic with a visible notice, while a newly entered numeric override is blocked before transport; valid old overrides remain selected.

The same resolver is used for analysis, translation, connection tests, native transport, and generic server model validation. Automatic selects the documented app default; it does not discover models, probe availability, fall back, or retry. Enter the provider's HTTPS API base address where required and paste the API key into the masked session-only field. Provider charges may apply. The key is not persisted or exported. Explicitly allow AI processing, test the connection, then use Check writing. Automatic AI requests are off by default. Android uses native HTTPS, subject to Android transport and provider/account/schema limits; web use requires provider CORS support. See `docs/BYOK.md` for setup, safeguards and verification limits.

## An existing local model without per-request fees

The optional Node adapter can use an already installed local OpenAI-compatible model server on your own computer, such as Ollama. No model is bundled or downloaded automatically. Hardware, storage, electricity, setup, model licensing and output quality remain your responsibility. A local model is not automatically available on the phone or public website.

For a loopback local model server, explicitly configure:

```sh
CYANWRITE_LOCAL_AI=true \
OPENAI_BASE_URL=http://127.0.0.1:11434/v1 \
OPENAI_MODEL=qwen3:4b \
node server/server.mjs
```

Then enable AI processing in Preferences. The chosen model must already be installed, available, and capable of the requested response format. The adapter's request/response and timeout limits still apply. No API key is needed for this explicit loopback-only setup. This integration is tested with a mock provider, not a downloaded real model. Optional translation and mother-tongue explanations still need such a capable model or a separately configured provider; they are not faked offline.

When using the optional Node adapter, remote providers need server-only credentials and may charge the account owner. Direct personal-key mode instead sends the session-only key directly to the selected provider over HTTPS. No credential is embedded, no remote provider is activated by default, and no paid service has been provisioned. Never expose the optional AI server publicly without authentication, TLS, abuse controls and a privacy policy. See `docs/SERVICE.md`.

## Privacy and honest limits

Offline checks make no external proofreading requests. Drafts and learning examples use unencrypted local storage. Avoid confidential writing on shared devices. Disabling draft saving does not delete separately enabled learning examples; use Clear learning history or Delete all data for that. AI opt-in permits sending the draft/settings/vocabulary to the provider or service you select. Manual Check writing triggers requests unless Automatic AI checks is explicitly enabled.

The offline rules are limited and cannot understand arbitrary English or guarantee correct rewrites. No software can honestly promise unlimited, error-free AI at zero operating cost. Review important writing, especially legal or administrative content. Comprehensive grammar coverage, an on-device large language model, universal translation, cross-device sync, a keyboard extension, accounts and plagiarism checks are not implemented.

## Publication

No public GitHub repository has been created. Public source publication and the exact payload remain subject to the owner's approval. No project license has been imposed. Build outputs, SDK paths, logs, signing keys and private environment files are excluded from the source delivery archive. This update does not publish or deploy the project.

## Project map

- `web/engine.js`: local correctness checks and structure integration.
- `web/structure.js`: completed-sentence boundaries and conservative mode-aware transformations.
- `web/learning.js`: local bounded pattern ledger.
- `web/app.js`: shared UI/state and consent controls.
- `web/ai.js`: personal-key provider adapters and validated model results.
- `web/native-ai.js`: cancellable Android HTTPS transport wrapper.
- `web/sw.js`: web application-shell offline cache.
- `server/server.mjs`: static server and optional local/remote model adapter.
- `android/`: shared-asset Android WebView host.
- `tests/`: deterministic engine, learning and mock-service regression tests.
