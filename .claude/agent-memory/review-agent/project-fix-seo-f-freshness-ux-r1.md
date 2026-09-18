---
name: fix-seo-f-freshness-ux-r1
description: freshness-honesty sitemap/legal/share/notice-popup PR R1 review — clean approval
metadata:
  type: project
---

fix/seo-f-freshness-ux R1 — APPROVED, no findings.

Verified live:
- buildStaticEntries.ts stays pure (no I/O), fully deterministic tests cover weekend/holiday
  session-close rewind (Sat lastmod pinned to Fri close, US 2026-01-01 holiday rewinds to 2025).
- loadStaticSitemapInputs (server.ts) is unstable_cache'd (1h) + fail-soft at every DB call
  (per-kind try/catch for news publishedAt and each terms.findActive); confirmed via
  loadStaticSitemapInputs.test.ts (DB-client-throws case resolves to {} not reject).
- getActiveTerms is React `cache()`-memoized so generateMetadata + page share one DB read;
  notFound() called outside <Suspense> in both terms/page.tsx and privacy/page.tsx (real 404,
  not soft-404); setRequestLocale kept so ISR/static rendering survives (revalidate=86400).
- share/[id]/page.tsx: notFound() on non-'found' status; NotFoundMessage.tsx is the only client
  island (needs usePathname), NotFoundContent.tsx stays server component; hook ordering correct.
- useDeferredReveal: state+effect ordering correct, timer+3 listeners cleaned up in one effect
  cleanup, NoticePopupLoader ssr:false wraps NoticePopup dynamic import.
- EconomyKrMacroFacts and KrEconomicIndicatorGrid consume the same `cards` array from one
  getKrIndicatorCards() call — no registry drift.
- .oxlintrc.json: added `src/entities/sitemap-entry/server.ts` to the exact allowlist category
  ("server-only orchestration(api.ts) ... deep import 필요") — justified: server.ts newly
  deep-imports DrizzleMarketNewsRepository from '@/entities/market-news/api'.
- package.json build script: `NEXT_BUILD_DATE=${NEXT_BUILD_DATE:-$(date -u ...)}` — offline
  pre-push build (.husky/pre-push, SIGLENS_OFFLINE_BUILD=1) doesn't set the env var, so it falls
  back unchanged; Dockerfile declares NEXT_BUILD_DATE ARG/ENV in both builder+runner stages with
  correct reasoning comment (force-dynamic sitemap reads it at runtime, not just prerender).
- All 4 locale catalogs (ko/ja/zh/en) have identical key sets for NotFoundContent,
  NotFoundMessage, krMacroFacts, and categoryDescription (18/18); categoryDescriptionCoverage
  test would fail on revert (checks TICKER_CATEGORY_DESCRIPTION_KEY registration + ko catalog
  presence for all 18 category labels).
- tsc --noEmit and oxlint both clean; 56 test files / 561 tests green in scoped run.

No regressions, no false claims found. Nothing to flag for round 2.
