---
name: reference-next-intl-literal-dot-in-message-key
description: next-intl rejects any catalog KEY containing a literal "." — breaks identity-keyed dynamic lookups (skillName-style) whose source string has a period
metadata:
  type: reference
---

next-intl's `validateMessages` (`use-intl/dist/esm/development/initializeConfig-*.js`)
walks the ENTIRE message tree at `NextIntlClientProvider`/`IntlProvider` mount and
rejects any key containing `.` (reserved for nesting) via `IntlErrorCode.INVALID_KEY`.
This is **non-fatal** — it logs via `onError` and the lookup falls back — which makes
it easy to miss: `t.has(key)` and `t(key)` on a dotted key just silently fail, so an
identity-keyed pattern (`t.has(sourceString) ? t(sourceString) : sourceString`, the
`shared.skillName`/`shared.assetName` style) silently returns the untranslated
original for any source string containing a literal `.` (decimals, version numbers,
sentence-ending periods, abbreviations like "0.94" or "(20, 10, 2.0)").

**Fix**: sanitize the key at both write-time (catalog build) and read-time (lookup
hook) with the same deterministic substitution — e.g. fullwidth period U+FF0E `．`
replacing ASCII `.`. Export the sanitizer function so tests can apply the identical
transform when asserting `toHaveProperty(...)` on the catalog (vitest's `toHaveProperty`
ALSO treats `.` as a nested-path separator, so the raw source string can't be used
there either once escaped).

Caught this while adding `shared.skillDescription` (siglens-i18n branch,
[[project_i18n_shared_seo_translator_threading]] session, 2026-08-20) — 12 of 74
skill descriptions contained `.` (e.g. `EWMA 변동성(RiskMetrics, λ=0.94)...`).
