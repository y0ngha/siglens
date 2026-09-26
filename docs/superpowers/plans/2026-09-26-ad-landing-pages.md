# Ad Landing Pages — Implementation Plan

Spec: `docs/superpowers/specs/2026-09-26-ad-landing-pages-design.md`

Goal: `siglens.io/lp/stock-analysis` and `ai.siglens.io/lp/stock-chat`, noindex, minimal chrome,
no crypto wording anywhere on the page.

## Task 1 — proxy (test first)

- Test `src/app/__tests__/proxy.lp.test.ts` (FakeResponse mock with `status`, like
  `proxy.aiHost.test.ts`):
  - main host `/lp/stock-analysis` → `NextResponse.next()`, intl middleware not called,
    `X-Robots-Tag: noindex, nofollow`.
  - ai host `/lp/stock-chat` → `rewrite` to `/lp/stock-chat` (not `/ai/<locale>/…`), header set.
  - cross-host (`/lp/stock-chat` on main, `/lp/stock-analysis` on ai) and unknown
    (`/lp`, `/lp/x`) → 404 with the header.
  - `/ko/lp/stock-analysis` → 301 to `/lp/stock-analysis` (not `/LP/…`): `lp` is reserved.
  - ai sitemap has no `/lp`.
- `src/proxy.ts`: `lp` in `RESERVED_FIRST_SEGMENTS`; `LP_PATH_BY_HOST` + `landingPageResponse()`;
  called first in `proxy()` (main) and in `handleAiHost()` after robots/sitemap.

## Task 2 — views (test first)

- Test `src/views/lp/__tests__/landings.test.tsx`: render both views; text (scripts stripped)
  must not match the crypto regex, `·`, `—`, `(가입|로그인) 없이`; CTA and logo hrefs; ticker
  links; FAQ has 3 items.
- `src/views/lp/ui/LpShell.tsx` — header (SIGLENS logo → page itself, one CTA) + footer
  (privacy, terms, disclaimer line).
- `src/views/lp/StockAnalysisLanding.tsx`, `src/views/lp/StockChatLanding.tsx`,
  `src/views/lp/index.ts` (barrel).

## Task 3 — app root `src/app/lp/` (test first)

- Test `src/app/lp/__tests__/metadata.test.ts`: both pages' `metadata.robots` is
  `{ index: false, follow: false }`, no `alternates`/canonical, no `openGraph`, and title +
  description free of crypto words.
- `src/app/lp/layout.tsx` — own `<html lang="ko">`/`<body>`, fonts, `globals.css`, theme init
  script, `GoogleAdsTag`. No providers, no global header/footer.
- `src/app/lp/stock-analysis/page.tsx`, `src/app/lp/stock-chat/page.tsx` — metadata + view.

## Task 4 — sitemap + i18n

- `buildStaticEntries.test.ts`: no entry contains `/lp`.
- `scripts/i18n/lib/scan.mjs`: add `src/app/lp/` and `src/views/lp/` to `EXCLUDE_RE` with a
  documented reason (Korean-only ad pages).

## Task 5 — E2E

- `e2e/specs/ad-landing.spec.ts`: each page 200 on its host with `X-Robots-Tag` and
  `noindex` meta; body HTML (scripts stripped) passes the crypto guard; cross-host 404.

## Gates

`yarn test` (full), `yarn lint`, `yarn typecheck`, `yarn format:check`, `yarn i18n:lint`,
`yarn i18n:verify`, `yarn build` (both `/lp/*` routes in the output).
