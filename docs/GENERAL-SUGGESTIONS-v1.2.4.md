# CyanWrite 1.2.4: suggestions that follow your settings

This review build consolidates the private DeepSeek routing repair and the general writing-suggestions work into one version: Android **1.2.4, code 9**, with matching web assets. It is not a GitHub publication or store release.

## Three visible types of help

The suggestions panel has persistent, separate sections for **Grammar & correctness**, **Sentence structure**, and **Writing mode & tone**. Each suggestion identifies its offline or AI source. Filters let you view one section. Empty sections explain that no supported improvement was proposed, rather than implying a complete proofread. The panel shows the selected mode and sentence style.

A tone-only rewrite is not a successful structure conversion. The structure status says explicitly when no structural change is proposed. Best automatic can retain a suitable sentence. Applying suggestions is optional and supports one-step undo.

## General rules, not one example

The seven writing modes and four sentence styles are inputs to both the shared offline engine and the optional AI review. The offline engine uses reusable wording and clause-pattern rules; it is not a list of replacements for one screenshot. Questions, statements, requests, exclamations, cause/effect, contrast, coordination, quoted text, legal language, names, numbers, paragraphs, and unfinished text are represented in the review corpus.

Changing a mode does not mean every sentence must change, nor should the app invent facts just to create a complex sentence. Some modes appropriately share neutral wording; a suitable sentence can remain unchanged. An explicit style request is treated separately from wording preference.

## AI and provider routing

AI results appear in the same three sections, with AI labels. Review instructions distinguish mode, tone, sentence kind and actual clause structure. Response validation checks offsets, enabled features and supported safety constraints, but it cannot prove semantic equivalence or grammatical correctness for arbitrary English.

The DeepSeek endpoint normalization repair and provider-specific model defaults remain in place. This build does not probe model availability, silently switch providers, or promise that a particular account can use a default model. Optional keys belong in the app’s masked, session-only Preferences field, never in chat or the source archive. Tests use synthetic keys and mocked provider responses, not a real provider account.

## Important limits

Offline rules are deliberately bounded; they are not a full English parser or a universal rewriting model. AI broadens coverage but can still miss errors, alter meaning or misunderstand structure. Quotations and legal obligations have additional protections, but critical writing still needs human review. Local structural protection for obligations and conditions applies across every mode, not just Legal. Ambiguous nested clauses are left unchanged rather than falsely labelled simple or compound. Legal mode is not legal advice.

Browser review and Android host unit tests do not establish real-phone WebView rendering, IME behavior or live-provider rewrite quality. The APK is debug-signed for owner review. The temporary HTTPS preview can sleep or expire; it is not permanent hosting. Browser and Android data are separate.

## Evidence and publication

The delivery includes a full JavaScript test log, Android test/build/lint output, a 28-combination × 27-sample outcome matrix (756 observed checks), browser assertions, and APK/web asset parity verification. The outcome matrix records suggested changes and honest no-op results; an outcome record alone is not an assertion of linguistic quality.

GitHub remains on the previously approved v1.2.2 release. No source, tag, APK, or release is pushed until the owner approves this exact v1.2.4 payload. The separate temporary web preview is refreshed for review only.
