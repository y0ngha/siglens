---
name: reference-extract-mjs-same-var-name-widening-collision
description: extract.mjs's dynamic-key namespace widening keys translator vars by NAME not scope — two hooks in one file both naming their translator `t` makes the second silently evict the first's namespace from wideNamespaces
metadata:
  type: reference
---

`scripts/i18n/extract.mjs`'s `keysForFiles()` builds a `Map<varName, namespace>` by
regex-scanning a whole file for `const X = useTranslations('ns')` / `getTranslations(...)`,
then checks each **variable name** for a dynamic-key call (`X(nonLiteralArg`) to decide
which namespaces get added to `wideNamespaces` (shipped in full to every consuming
route's client bundle). This scan is **not scope-aware** — it's a flat per-file regex
pass, so if two functions in the same file both declare their translator as `const t =
useTranslations(...)` (different namespaces, different function scopes), the `Map.set('t',
...)` for the second declaration overwrites the first. Only the namespace of whichever
`useTranslations(...)` call is parsed LAST in the file gets widened; the other's dynamic-key
namespace silently vanishes from `wideNamespaces` for every route that reaches the file.

Symptom: adding a second dynamic-lookup hook to an existing file (e.g. `useSkillDescription`
next to `useSkillLabel` in `skillLabel.ts`, both named `t`) made `shared.skillName` disappear
from `[symbol]`/`share/[id]`/chrome's `wideNamespaces` after `yarn i18n:extract --write`,
even though nothing about `useSkillLabel`'s own code changed. Caught by
`clientKeyCoverage.test.ts`'s dedicated "동적 조회 테이블이 소비 라우트에만 실린다" suite —
run that suite (or eyeball `messages/_meta/clientKeys.json`'s `wideNamespaces` for the
routes involved) after touching any file with more than one `useTranslations` call.

**Fix options, in order of laziness**: (1) give the second translator a distinct variable
name (`tDescription` not `t`) — smallest diff, keeps both hooks in one file. (2) split the
hooks into separate files if they also need independent widening blast-radius (see
[[project_chrome_wide_namespace_cascades_to_all_routes]] for why option 1 alone doesn't
shrink payload size — only avoids the *wrong namespace disappearing* bug, not blast radius).

See [[reference_extract_mjs_dynamic_key_widening]] for the base mechanism this bug is a
corner case of. Found on siglens-i18n branch, 2026-08-20.
