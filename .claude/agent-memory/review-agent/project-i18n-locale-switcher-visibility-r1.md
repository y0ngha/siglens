---
name: project-i18n-locale-switcher-visibility-r1
description: feat/i18n-locale-switcher R1 — LOCALE_SWITCHER_VISIBLE flip false->true, ai-host non-issue confirmed
metadata:
  type: project
---

2026-09-15 user decision to expose the language switcher: `LOCALE_SWITCHER_VISIBLE`
in `src/shared/i18n/locales.ts` flipped false→true (doc comment updated), e2e skip
comment updated, 2 new unit tests (Header + HeaderMobileMenu render `locale-switcher`
testid, mocked), `messages/_meta/skips.json` line-number-only regen. All verified clean
in R1 — approved with zero findings.

Checked and ruled out as non-issues (worth remembering to avoid re-litigating):
- ai.siglens.io host: grepped `src/app/ai/**` — no file imports `widgets/layout` at
  all, so `Header`/`LocaleSwitcher` never renders there. The "does next-intl
  `router.replace` produce a correct URL on the ai host" question is moot because
  the component tree it would run in doesn't exist on that host.
- `STATIC_INDEXABLE_LOCALES` (in `indexableLocales.ts`, separate file from
  `locales.ts`) is untouched and correctly independent of the visibility flag per
  its own JSDoc (SEO indexing gate vs. UI switcher visibility are deliberately
  decoupled).
- No stale docs found describing the switcher as hidden — the only doc hits were
  unrelated ("mobile view switcher" in ai-chat plan) or historical spec prose
  documenting a past decision, not living guidance.
