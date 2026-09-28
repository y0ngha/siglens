# Crypto Market Fear & Greed Page — Design (siglens)

Date: 2026-09-25
Depends on: `@y0ngha/siglens-core` release with `computeCryptoFearGreedIndex` /
`computeCryptoFearGreedHistory` (spec: siglens-core
`docs/superpowers/specs/2026-09-25-crypto-fear-greed-design.md`).

## Goal

Add `/[locale]/fear-greed/crypto` — a crypto market Fear & Greed page that looks and behaves
like `/fear-greed` (US) and `/fear-greed/kr`, with the same SEO treatment. Traffic goal is
organic search ("코인 공포탐욕지수", "코인 공포지수", "크립토 공포지수", "암호화폐 공포탐욕지수",
monthly 1K–10K each). Google Ads cannot promote it in Korea (crypto certification), so the
paused "코인 시장 공포탐욕지수" ad group stays paused.

## Scope boundary

All scoring lives in core. siglens owns: symbol list, FMP fetch, calendar cut-off, caching,
view shaping (snapshot + 1w/1m/1y comparisons), page, nav, i18n, SEO, alarm.

## Data

`src/entities/market-fear-greed/lib/marketFearGreedCryptoSymbols.ts`
- `benchmark`: `BTCUSD`
- `safeHaven`: `GCUSD` (gold, 5-day calendar; core forward-fills)
- `universe` (19): ETHUSD XRPUSD SOLUSD BNBUSD DOGEUSD ADAUSD TRXUSD LINKUSD LTCUSD AVAXUSD
  DOTUSD BCHUSD XLMUSD SHIBUSD HBARUSD SUIUSD TONUSD UNIUSD NEARUSD — all verified 2026-09-25
  to return ≥ 3 years of daily bars with non-zero volume. No stablecoins.
- Lookback: 1095 calendar days (same as US/KR).

`fetchCryptoDailyBars.ts`
- FMP `/stable/historical-price-eod/full?symbol=…&from=…&to=…` → `{ date, close, volume }`.
  FMP crypto `volume` is quote (USD) volume, so all coins share one currency.
- `to` = the last fully closed UTC day (yesterday, UTC). Never request the in-progress day —
  FMP returns the live tick as that day's "close" (same failure the US page hit with
  `lastClosedSessionDateEt`).
- `200 []` or a non-array throws (never silently empties the join), matching `fetchDailyCloses`.
- GCUSD uses the same endpoint (`close` only; volume ignored).
- E2E: fixture branch like `e2eFearGreedFixture` (no FMP key in CI).

Cost: 21 FMP calls per refresh, at most once per hour (cache below).

## Cache and view

- `marketFearGreedCryptoCache.ts`: Redis 1h fixed TTL, key versioned like the KR cache. Do not
  use `computeBarsEffectiveTtl` (same reasoning as the US page: bars finalise after close).
- `marketFearGreedCryptoStaticCache.ts`: `React.cache` + `unstable_cache` 1h, tag shared with
  the other two static caches.
- View = `{ snapshot, comparisons }` built from `computeCryptoFearGreedHistory` via
  `buildMarketFearGreedComparisons` (now / 1w / 1m / 1y). Comparisons count calendar days
  (crypto trades every day).

Model change: `MarketFearGreedView` becomes generic over the snapshot type
(`MarketFearGreedView<S extends { factors: { key: string }[] } = MarketFearGreedSnapshot>`), so
the widgets render either snapshot without casts.

## Page

`src/app/[locale]/fear-greed/crypto/{layout,page}.tsx` — copy of the `kr` route:
`revalidate = 3600` literal, `setRequestLocale`, graceful catch → empty view, degraded
(`snapshot === null`) → noindex + no canonical + no WebPage/Breadcrumb JSON-LD (FAQ JSON-LD
stays).

`FearGreedMarketId` gains `'crypto'`. Consumers updated:
- `FearGreedRouteBody`: factor list comes from the market (`CRYPTO_FEAR_GREED_FACTOR_KEYS` for
  crypto) instead of the hard-coded `MARKET_FEAR_GREED_FACTOR_KEYS`.
- `MarketFearGreedPage` / `MarketFearGreedFactorBar`: iterate the snapshot's own factors.
- `useMarketFactorLabels`: crypto labels and descriptions under
  `shared.lib.fearGreedFactor.label.*` / `descriptionCrypto.*` for the six crypto keys.
- `copy.ts`: `crypto` entry — path `/fear-greed/crypto`, title, description, keywords, intro,
  FAQ.

### Copy (ko source; en/ja/zh via i18n)

- Title: "코인 공포탐욕지수 - 오늘 암호화폐 시장 심리".
- Keywords: 코인 공포탐욕지수, 코인 공포지수, 코인 탐욕지수, 크립토 공포지수,
  암호화폐 공포탐욕지수, 비트코인 공포탐욕지수, crypto fear and greed index.
- Intro: what the 100-point scale means; six factors in one sentence each.
- FAQ must state: (1) differs from alternative.me — no social/survey data, computed from
  prices and volume; (2) the 20-coin list is today's large caps, so older periods carry
  survivorship bias; (3) crypto trades 7 days, gold 5 days — weekends reuse Friday's gold
  close; (4) updated daily at 00:00 UTC close; (5) not investment advice.
- Copy rule for this project: no middle dot (·) and no em dash (—) in new user-facing text.

## Navigation and links

- `assetClassNav.ts` fear-greed vertical: add region `crypto` (`/fear-greed/crypto`,
  `shared.config.nav.full.fear-greed.crypto`). `RegionTabs` picks it up.
- `/[symbol]/fear-greed` market links: crypto symbols link to `/fear-greed/crypto`
  (currently US/KR only).
- About pages that list the fear-greed pages: add the crypto link.

## SEO (same as US/KR)

- `generateMetadata`: title/description/keywords, `localeAlternatesFrom` (hreflang, self
  canonical per locale), OpenGraph/Twitter with `/og-image.png`, `localeRobots`.
- JSON-LD: WebPage (`dateModified` = snapshot `asOf`), BreadcrumbList, FAQPage.
- Sitemap: `buildStaticEntries` already emits every `ALL_NAV_REGION_LINKS` entry, so the new
  nav region is picked up automatically (daily + 0.8 like `/fear-greed*`). Required change:
  `lastModifiedFor` must return the last closed UTC day for `region === 'crypto'`; today it
  falls through to the US session close.
- `proxy.ts`: nested path, not a top-level segment, so no reserved-segment change; the
  existing uppercase-301 scanner test covers it.

## Observability

- Log prefix `[FearGreedCryptoRoute]`; CloudWatch metric filter + alarm
  `siglens-fear-greed-crypto-loader-failed` in `infra/aws/07-alarms.sh` (threshold 4 per hour,
  same reasoning as US). The script is not run by the pipeline — run once manually after deploy.

## Tests

- `fetchCryptoDailyBars`: `to` = yesterday UTC; `200 []` throws; volume mapped.
- Cache/view: comparisons pick calendar-day offsets; degraded view on core `null`.
- Route: metadata (noindex when degraded), JSON-LD presence rules, `setRequestLocale` call.
- `FearGreedRouteBody` renders six crypto factors with crypto labels.
- Nav/sitemap: new region present; uppercase-301 scanner passes.
- i18n: `yarn i18n:extract --write`, 4 locales complete.
- E2E: page renders with fixture data.

## Out of scope

- Cross-market comparison gauge (US vs KR vs crypto on one card) — tabs already link them.
- Changes to per-symbol crypto Fear & Greed.
- Google Ads for this page (policy).
