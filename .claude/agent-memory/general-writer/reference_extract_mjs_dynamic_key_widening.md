---
name: extract-mjs-dynamic-key-widening
description: scripts/i18n/extract.mjs's dynamic-key namespace widening only fires on a literal `varName(` call in the SAME file as the useTranslations() declaration — passing the translator as a function argument (even to a same-file helper) is invisible to it, and (pre-fix) widening one translator silently dropped literal keys for every other translator in that file too.
metadata:
  type: reference
---

Found while adding `shared.enumLabel` (a `t(KEY_MAP[value])`-style dynamic-key
namespace) to `feat/i18n-multilingual` (siglens-i18n worktree, 2026-08-20).

**Gotcha 1 — widening detection is per-literal-call-site, not per-value-flow.**
`keysForFiles()` in `scripts/i18n/extract.mjs` decides a translator variable
"uses a dynamic key" (and therefore widens its whole namespace into that
route's `clientKeys.json` entry) by regex-matching `\bvarName\(\s*(?!['"])`
literally in the file's source text. If a `'use client'` component does
`const tLabel = useTranslations('shared.enumLabel'); ...; helperFn(value,
tLabel)` — passing `tLabel` as an argument to a helper (even one in the same
file, e.g. a module-level formatter, or a shared pure-lib function like
`sentimentLabel(value, t)`) — the regex never sees `tLabel(` and the
namespace silently fails to widen. Runtime symptom: `MISSING_MESSAGE` in the
browser only, because `RouteMessages.tsx`/`pickMessages` slice the client
provider's messages down to exactly what `clientKeys.json` lists per route —
server components are unaffected (they always see the full catalog via
request config), so this class of bug **only shows up on `'use client'`
consumers**, and only in the browser, never in tsc/build/most tests.

Fix pattern: in the `'use client'` file that owns the `useTranslations(...)`
declaration, call the translator **directly and literally** —
`tLabel(SOME_KEY_MAP[value])` inline — rather than delegating through a
wrapper function that takes `t` as a parameter. This meant exporting the
plain `Record<Enum, string>` key maps (e.g. `SENTIMENT_LABEL_KEY`) from the
pure-lib files instead of only exporting the `resolve(value, t)` wrapper
functions design intended for server-only/pure-function consumers. For a
pass-through into a *different* file's exported function (e.g.
`buildExpertAnalysisReport({ ..., t: tLabel })`), a one-line identity
adapter closure works and is enough to satisfy the regex: `t: (key, values)
=> tLabel(key, values)`.

**Gotcha 2 — (pre-existing bug, fixed as part of this same task) widening one
translator in a file used to skip literal-key collection for every other
translator in that file too.** The code had `if (widened) continue` at the
file-loop level right after computing which translators are dynamic —
this skipped the literal-key regex scan for the *entire file*, not just the
widened translator. A file that legitimately mixes a literally-keyed
translator (`t('MarketNewsDigest.69a497')`) with a dynamically-keyed one
(`tLabel(KEY[value])`) — completely normal once you add an enum-label
translator to an existing widget — silently lost all of the first
translator's literal keys from `clientKeys.json` for every route reaching
that file. The function's own doc comment claimed literal-only translators
in the same file "get collected below" — the code didn't actually do that.
Fixed by tracking widened translator *names* in a `Set` and excluding only
those from the literal-collection regex, instead of `continue`-ing past the
whole block. Real-world trigger caught by `clientKeyCoverage.test.ts`
(`src/shared/i18n/__tests__/`) — it independently re-derives per-route
required keys and diffs against `clientKeys.json`, so it's the authoritative
regression gate for this whole class of bug; run it whenever a dynamic-key
namespace touches a file that already has other `useTranslations` calls.

See [[project_i18n_shared_seo_translator_threading]] for the sibling
required-translator-param pattern (server-side, `SeoTranslator`) that this
`EnumLabelTranslator`/`shared.enumLabel` work extended to enum display
labels, and where the "give pure-lib functions a required `t` param" design
came from.
