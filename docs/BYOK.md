# Use your own AI key

CyanWrite 1.2.2 (version code 7) adds optional personal-key AI without changing the free offline core. Provider charges may apply. A key is not a guarantee of correct writing, universal API compatibility or account access to every model.

## Set up on your phone

Open **Preferences → Optional AI · your own API key**. Select **My own API key**, choose OpenAI, DeepSeek, Google Gemini, Anthropic Claude, or **Other OpenAI-compatible provider**, then choose how the model is selected:

- **Automatic / app default** uses the provider default: Gemini `gemini-3.8-flash`, OpenAI `gpt-4o-mini`, or DeepSeek `deepseek-flash`.
- **Manual** uses the exact model ID entered by you. Anthropic and custom providers remain manual-only and require an exact model ID; CyanWrite does not discover models or fall back to another model.

A blank saved override means **use the default**; it is not a missing Gemini model error. Gemini's default is `gemini-3.8-flash`, as documented in the [official Gemini model documentation](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash). The saved `models/` prefix used by older Gemini entries is normalized before the request. A valid old override remains selected. An old numeric entry such as `2` is repaired to Automatic and a visible notice explains the repair; a newly entered numeric model override is rejected before any network transport. Custom providers also need their HTTPS API base address. Do not paste the entire chat-completions URL: the app appends the appropriate API path.

The same model resolver and validation are used by analysis, translation, connection test, native transport, and generic server model validation. Automatic means selecting the documented app default; it is not model discovery, availability probing, fallback, or retry behavior.

Paste the API key into the masked field and enable **Allow AI processing**. **Test connection** sends a short sample and may incur a provider charge. A successful test confirms a valid response from that model, not the quality of every feature. Use **Check writing** to send the current draft. Translation also needs its own switch and the selected mother tongue.

The key stays in memory only. It is not saved in drafts, learning exports, local storage, the APK, or the source archive. Re-enter it after closing or reloading the app, including activity recreation. **Clear key** removes it immediately. Changing provider or API address clears it too. Endpoint and model preferences are saved locally, without the key. Only trust endpoints you control or recognize: the selected endpoint receives the key and writing.

## Provider notes

DeepSeek uses the official base address `https://api.deepseek.com` and default model `deepseek-flash`. Manual mode accepts an exact account-supported model ID; no key is supplied or model enabled automatically. The app sends OpenAI-compatible Chat Completions requests to `/chat/completions`, authenticates with a Bearer header, and requests JSON output. Switching providers resets the endpoint/model preset and clears the session key.

Gemini uses its GenerateContent adapter and the app default above. Anthropic uses Messages and remains manual-only. OpenAI and other OpenAI-compatible providers use the selected exact model where manual mode is required or the documented app default where supported. Model access, availability and pricing are controlled by each provider; CyanWrite does not discover, switch, or retry models.

The [official DeepSeek setup documentation](https://api-docs.deepseek.com/) lists its endpoint and model information. [DeepSeek JSON Output guidance](https://api-docs.deepseek.com/guides/json_mode) notes that responses can sometimes be empty; CyanWrite reports invalid output and keeps offline checks, without automatically retrying a potentially paid request. No live key or billable provider request was used for this release.

## What AI receives and does

Analysis requests contain the draft (at most 12,000 characters), enabled proofreading categories, writing mode, sentence-structure selection, mother tongue, and up to 100 imported vocabulary words. Translation is a separate request. The app asks the model to preserve meaning, facts, names, numbers, legal obligations, negation and conditions. Mother-tongue explanations and requested register/structure are instructions to the model, not a mathematical guarantee of compliance.

Returned suggestions must match exact original UTF-16 text offsets. Disabled categories, unsafe offsets, no-op replacements, unimported vocabulary replacements, and incomplete-sentence structure suggestions are rejected. Suggestions are never applied automatically. Invalid or unavailable AI does not remove the offline checks.

**Automatic AI checks** are off by default. When enabled, a 1.5-second typing pause can trigger new analysis and, if enabled, translation requests. These may be billable, even when later cancelled. Changing a preference or applying a suggestion runs local checks; use Check writing again to refresh AI suggestions. There is no automatic model discovery, fallback, or retry of a paid request.

## Compatibility, privacy and limits

OpenAI-compatible means an API that accepts Chat Completions with the app's JSON-object response format. Not every vendor's API or model supports it. Gemini uses GenerateContent with a header key; Anthropic uses Messages. The account must support the selected model and API capability. Billing limits, invalid keys, retired models, network failures, provider schema differences, and unsupported response formats can prevent a connection.

The APK uses an asynchronous native HTTPS transport with certificate validation, no redirects, limited request/response sizes, four in-flight requests at most, cancellation and bounded timeouts. Private/local network destinations are rejected for direct personal-key calls. The web version uses browser fetch and needs provider CORS support. Never disable browser security to bypass a CORS error. Android/native and web transports have their platform limits; Android does not make an unsupported account, model, schema, or provider available. Existing trusted CyanWrite servers/local-model adapters remain available under the alternative connection type; their existing configuration and security requirements still apply.

Drafts and learning examples remain unencrypted local data. Provider retention policies and charges are controlled by that provider. Direct personal-key mode does not use a CyanWrite relay server. The key is session-only and is cleared on the documented provider/address changes and when the app session ends.

## Why some basic errors were missed

The earlier offline core used a small hand-written rule set; it was not a comprehensive grammar engine. Missing an arbitrary error did not mean that an AI had checked it. This update adds conservative agreement checks and selected incorrect past-tense forms after “did”, alongside the existing spelling and grammar rules. It still cannot understand every English sentence. A correct sentence such as “I was there” must not be changed merely to make a rule appear active.

## What was verified

The 1.2.0 release passed 65 JavaScript tests, five resource-aware Android startup/export tests, Android debug assembly and lint. A real browser session passed 13 shared-UI checks: manual-only requests, analysis plus translation, result rendering, mother-tongue prompt, key privacy, authentication errors, local fallback, key clearing, spelling/grammar Apply, and Undo. Provider responses in these tests were mocked; no paid model was used for validation.

Android tests do not execute the Chromium WebView renderer or prove a physical-phone install. No physical device/emulator test, live-provider quality test, universal grammar coverage or flawless-AI claim is made. The earlier review APK was debug-signed, version 1.2.1/code 6, not a store release. No source has been published publicly.

Version 1.2.1 added eight DeepSeek-specific mocked tests (73 JavaScript tests total), including both models, exact endpoint/authentication, validated suggestions, translation, safe errors, cancellation, endpoint guards and the native transport bridge. The accompanying 1.2.1 test/build history remains applicable.

Current 1.2.2/code 7 verification: all 83 JavaScript tests passed; 25 model-selection browser checks and 18 DeepSeek browser checks passed with mocked providers; five of five resource-aware Android tests passed; and `assembleDebug` plus `lintDebug` succeeded with six warnings and zero errors. These checks do not prove a physical-device or emulator WebView install or live-provider quality. No real key or billable request was used. Final clean APK packaging was still in progress to exclude temporary local test-harness assets; no public publishing or deployment was performed.
