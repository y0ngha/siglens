---
name: seo-d-news-category-r1
description: fix/seo-d-news-category R1 — scraped-content SEO fix for /news/[category], approved
metadata:
  type: project
---

R1 approved, zero findings. Verified live:
- MarketNewsCard: `resolveNewsBody`/body section fully removed from card (summary+badges+source-link only); sibling NewsList.tsx and getNews.ts tool untouched, still legitimately use `resolveNewsBody` (not a regression — different surface, full body is fine in chat tool context).
- `/news/[category]/page.tsx`: category description `<p>` under h1 uses `tNav(cfg.descriptionKey)` where `tNav = getTranslations()` (root scope, no namespace) — confirmed `entities.market-news.category.*.description` keys exist in all 4 locales (en/ko/ja/zh) via direct JSON parse, not just grep.
- D5: per-article JSON-LD `image` field removed (was reusing one category OG image for every article) — test updated to assert `undefined`, matches [[reference-hashes-json-misc-namespace-gap]] pattern of the codebase preferring omission over misrepresentation.
- `/news/page.tsx` D6: `previewCategoryOf('us')` hardcoded to `'stock'` to avoid duplicating `/news/us`'s first-card `general` preview. Mutation-verified live (reverted the branch, D6 test failed as expected, restored).
- `messages/_meta/clientKeys.json` correctly drops `widgets.market-news.MarketNewsCard.c67b87`; `hashes.json` still has the orphaned hash entry but this repo already carries ~1717 pre-existing orphaned hash keys (measured directly) — not a new defect, matches [[reference-hashes-json-misc-namespace-gap]].
- isBot.ts change is comment-only (doc correction), no behavior change.
- BLOCKED(D3) comment in page.tsx replacing the old TODO is well-justified (cites core's own `@internal` JSDoc + cross-repo scope guard) — judged acceptable as-is, not a plain-note downgrade.
- `yarn tsc --noEmit` clean on touched files; scoped `yarn test` 32/32 green.
