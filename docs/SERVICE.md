# CyanWrite optional server adapter

For direct personal API-key setup (no relay server required), see [Use your own AI key](BYOK.md). The environment-variable instructions below apply only to the optional Node adapter, not to the session-only direct-key fields in Preferences.

CyanWrite is useful offline: `web/engine.js` exports `analyze(text, options)` and returns conservative review prompts. Local grammar rules are deliberately narrow (`alot`, `discuss about`, `Their are`, and `look forward to hear`); correct “There are” and “cannot” are not flagged. Imported vocabulary is **advisory only**: it never supplies a replacement from `context` (or any invented text), and its meaning/context is reported as unverified.

## HTTP API contract

Run `npm test`, then `node server/server.mjs` (default `127.0.0.1:8787`; set `PORT` and `CYANWRITE_HOST` to change it).

- `POST /api/analyze` body: `{ "text": string, "options"?: object, "aiOptIn": true, "mode"?: string, "structureType"?: string, "motherTongue"?: string, "vocabulary"?: Vocabulary[] }`
- `POST /api/translate` body: `{ "text": string, "aiOptIn": true, "mode"?: string, "motherTongue"?: string, "vocabulary"?: Vocabulary[] }`
- Both AI endpoints require the explicit top-level `aiOptIn: true`; otherwise they return `400` and do not contact a provider. Analyze always runs deterministic local rules after validation.
- `GET /api/health` responds `{ "ok": true, "ai": boolean }`.

The static root is `web/` only: `/` serves `web/index.html`, and source files outside `web/` are not exposed. Same-origin requests are allowed by matching the request `Host`; configured `ALLOWED_ORIGINS` entries are also accepted. Forwarded-host headers are not trusted. Inputs are capped at 50,000 characters, provider response bodies are bounded at 500,000 bytes, and basic per-IP rate and concurrency limits are enabled.

AI prompts honor feature toggles, writing mode, selected structure type, and selected explanation language. Structure issues must refer to complete sentences; remote categories disabled by the request are filtered, and vocabulary replacements must be exact imported words. AI responses are strict JSON and offsets are checked against submitted text. The prompt requests that no facts be invented; validation cannot prove semantic accuracy, so a model may still produce incorrect content.

## Optional provider configuration

Set these **server-only** environment variables; never put the key in static frontend code:

```sh
export OPENAI_API_KEY='...'
export OPENAI_BASE_URL='https://your-openai-compatible-provider/v1'
export OPENAI_MODEL='your-model' # optional
```

The optional AI path is not live in a static preview. Configure a provider only after obtaining user consent for draft transmission. Local rules and AI suggestions are not comprehensive or legally authoritative; review important writing yourself.

## Optional model running on your own computer

Explicit `CYANWRITE_LOCAL_AI=true` allows a keyless provider only when `OPENAI_BASE_URL` has a loopback host (`localhost`, `127.0.0.1`, or `[::1]`). Example with an already installed local Ollama-compatible model:

```sh
CYANWRITE_LOCAL_AI=true OPENAI_BASE_URL=http://127.0.0.1:11434/v1 OPENAI_MODEL=qwen3:4b node server/server.mjs
```

This avoids per-request remote-provider fees, but requires your own hardware, storage, electricity and model installation. It has been mock-integration tested, not validated with a downloaded real model. Model output still needs review. It is not an AI service bundled into the APK or supplied by the static preview. The adapter's request timeout and limits apply. The local core now includes supported whole-sentence structure rewrites and mode-aware register changes without using any model.
