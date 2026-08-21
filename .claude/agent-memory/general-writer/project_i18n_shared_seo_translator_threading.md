---
name: project-i18n-shared-seo-translator-threading
description: siglens-i18n branch — localized shared/lib/seo.ts title/description builders via a required SeoTranslator param and shared.seo catalog namespace. Gotchas found while implementing it.
metadata:
  type: project
---

Implemented on `feat/i18n-multilingual` (worktree `siglens-i18n`, 2026-08-20):
made `src/shared/lib/seo.ts`'s ~16 title/description builder functions
(`buildSymbol*SeoContent`, `resolveSymbol*SeoContent`, `backtestingTitle`,
etc.) take a required `SeoTranslator = (key, values?) => string` param
(no default — the point is the compiler must list every call site).
Catalog namespace `shared.seo` in `messages/{ko,en,ja,zh}.json`, registered
in `manualKeys.json` under `preserve` only (not `chromeWide` — server-only).

**Non-obvious gotchas hit along the way:**

- `koreanName` injection into symbol titles (`composeSymbolTitle`/
  `buildTitleSubject`) is locale-independent by design — a ticker with a
  curated Korean name (e.g. AAPL → "애플") still shows "애플(AAPL)" on the
  English page. This is deliberate brand-SEO, not a translation bug. A
  "no Hangul in en title" regression test must use a fixture WITHOUT
  `koreanName`, or it will false-positive on this legitimate behavior.

- Converting a module-level JSX `const` (e.g. a disclaimer notice) into a
  named function component so it can receive a translator prop makes
  `yarn i18n:extract --write` newly eligible to auto-extract its plain
  Korean string literals into the catalog (as orphan keys with no `t()`
  call referencing them, since `--write` without `--apply` only catalogs,
  doesn't rewrite source). If that JSX is intentionally out-of-scope body
  prose, keep it as a module-level const (extractor skips
  `module-scope-or-helper`), not a component function — don't "fix" this by
  running `--apply` and translating the newly-caught strings, that's scope
  creep beyond title/description/h1.

- `yarn i18n:verify`'s glossary gate (gate 3) is a raw substring match, not
  semantic. Ko text using a glossary word in an unrelated sense (e.g.
  "가입은 옵션이며" = "signup is optional", not "options" the financial
  term) still trips the gate demanding "Options"/"オプション"/"期权" appear
  in the translation. The script's own comment cites this exact class of
  false positive. Fix by rewording the ko source (e.g. "옵션" →
  "선택 사항") rather than forcing a wrong-meaning glossary term into the
  translation.

- Symbol title glossary trap: ko copy phrased as `지지·저항선` (support·
  resistance-line, "선" suffixing only 저항 not 지지) makes "저항선"
  (Resistance) a literal substring even though "지지선" (Support) is not.
  Glossary then requires the ja translation to literally contain
  "レジスタンスライン" — a more natural word like "抵抗線" fails gate 3.
  Worth grep-checking glossary terms as substrings of your ko draft before
  translating, not just eyeballing "does this get the term across".

See [[reference_next_intl_usetranslations_bare_call]] for a related testing
gotcha from the same task.
