# 암호화폐 지원 릴리스 실증 검증 Spec (v0.25.1 → HEAD `0bd57d1b`)

> 목적: 최근 머지된 **암호화폐(crypto) 지원** 기능을 `RELEASE_VERIFICATION.md` 플레이북에 따라
> **prod처럼 빌드·실행**해 동작/SEO를 실증한다. E2E·단위가 커버해도 prod 빌드 산물·정적
> prerender·메타데이터·캐시 헤더 관점에서 curl + Chrome으로 직접 확인한다.
>
> ⚠️ 이 문서는 **케이스 정의 전용**이다. 실행/PASS·FAIL 기록은 별도 실증 세션에서 채운다.
> 값은 모두 코드에서 읽어 그라운딩했으며, 임의로 만든 값은 없다.

---

## 0. 검증 전제 / 환경

- 범위: 태그 `v0.25.1` ~ HEAD `0bd57d1b` (PR #619 routing/data, #621 tabs/analysis/chat, #622 SEO/discovery).
- 빌드: `E2E_TEST` 미설정 prod 빌드 (`yarn build`; exit code는 파이프 없이 `> log 2>&1; echo $?`로 캡처) → `yarn start`.
- DB(docker) 필수 — 정적 prerender가 빌드 타임에 `crypto_assets`/`korean_tickers`를 실제로 읽는다.
  특히 sitemap/검색/`getAssetInfo` 경로는 `crypto_assets` 시드가 없으면 crypto가 us-equity로 fallback되어
  탭/SEO가 잘못 검증된다. **검증 전 `crypto_assets`에 BTCUSD/ETHUSD/SHIBUSD가 시드되어 있어야 한다.**
- `NEXT_PUBLIC_SITE_URL` 기본값은 `https://siglens.io`(`seo.ts:9`). 로컬은 보통 `http://localhost:4200`로 뜨므로,
  canonical/OG/sitemap의 절대 URL prefix는 **실측 환경의 `SITE_URL` 값으로 치환**해 단언한다. 본 문서는
  표기 편의상 `${SITE_URL}`로 적되 프로토콜·호스트는 실측값을 사용한다.
- prod DB 절대 미접촉. 검증 후 `.env.local`·검증 seam·시드 원복.

---

## 1. 변경 범위 요약 (Change Scope Summary)

`git diff --stat v0.25.1..HEAD` 기준 134개 파일 변경(+5,464/−335). core `@y0ngha/siglens-core`를
**0.26.0**으로 bump(`900a3d67`)해 crypto `assetClass`/`MarketSessionSpec` API를 사용한다.

### Plan 1 — MarketProfile descriptor 기반 (`shared/config/marketProfile/*`)
- `MarketProfileDescriptor` 타입 도입: `id`(`us-equity`|`crypto`), `assetClass`(`equity`|`crypto`),
  `priceFormat`(precision rule), `sessionModel`, `dataProvider`, `toProviderSymbol`, `newsSource`,
  `exchangeWhitelist`, `searchSource`, `tabs`, `defaultTimeframe`/`allowedTimeframes`, `seo.aboutNodeType`,
  `sitemapLastmod` (`types.ts`).
- `CRYPTO_DESCRIPTOR`: precision `dynamic-by-magnitude`, session `always-open`, news `crypto`,
  `exchangeWhitelist: null`, tabs **`['chart','news','fear-greed','overall']`**, allowedTimeframes
  `['5Min','1Hour','1Day']`, `seo.aboutNodeType: null`, `sitemapLastmod: 'rolling'` (`crypto.ts`).
- `US_EQUITY_DESCRIPTOR`: precision `fixed/2`, session `us-equity-et`, tabs 8종(chart/news/fundamental/
  financials/congress/options/fear-greed/overall), `aboutNodeType: 'Corporation'` (`usEquity.ts`).
- `registry.ts`: `getDescriptor`, `marketProfileOf(asset)`(profile 없으면 `us-equity` fallback),
  `DEFAULT_MARKET_PROFILE='us-equity'`.

### Plan 2 — 라우팅/데이터 레이어 + latent-bug 수정 (PR #619)
- **BTCUSD 404 수정**: 심볼 게이트를 `VALID_TICKER_RE`(`/^[A-Z][A-Z.-]{0,7}$/`)에서 `SYMBOL_EDGE_RE`
  (`/^[A-Z0-9][A-Z0-9.-]{0,15}$/`, digit-first/하이픈/최대 16자 허용)로 확장(`ticker.ts`). 모든 `[symbol]`
  페이지가 `isAdmissibleSymbolShape`로 형상 pre-check.
- **차트 sub-cent 정밀도 수정**: `formatPrice`/`dynamicDecimals`(`priceFormat.ts`) 추가 —
  `abs>=1`→2자리, `abs<1`→`floor(-log10(abs))+4` significant(상한 12). StockChart가 descriptor의
  precision으로 캔들·오버레이 소수 자릿수를 결정(`StockChart.tsx`, `OverlayLegend.tsx`).
- **exchange filter 수정**: us-equity는 `US_EXCHANGES` 화이트리스트, crypto는 `exchangeWhitelist: null`
  → 거래소 필터 우회, `crypto_assets` DB 멤버십으로 분류(`api.ts`, `cryptoAssetStore.ts`).
- crypto 심볼 해결: `getAssetInfo`가 `crypto_assets` 조회(`getAssetInfo.ts`, `cryptoQuoteName.ts`),
  검색이 crypto 결과 머지(`searchTicker.ts`), `resolveAssetClass`/`resolveMarketProfile` 서버 헬퍼.
- 24/7 interim cache TTL(`getCachedMarketDataProvider.ts`, `CachedMarketDataProvider.ts`).
- **degraded/notFound 가드**: `isUnresolvableDegraded(ticker, degraded)`(`symbolGuard.ts`) —
  degraded + `VALID_TICKER_RE` 불합격(digit-first crypto가 양 소스 동시 다운) → `notFound`. 형상은
  유효하나 실재 안 함(`assetInfo: null`) → `notFound`/`NOINDEX_SYMBOL_METADATA`. 5개 sibling 페이지 일관.

### Plan 3 — 탭/분석/챗 wiring + core 세션 통합 (PR #621)
- **탭 필터링**: `tabsFor(profile)`(`symbolTabsConfig.ts`)가 descriptor `tabs`로 SymbolTabs 노출
  탭을 제한. crypto는 fundamental/financials/congress/options 탭이 보이지 않음(`SymbolTabs.tsx`).
- **equity-only 탭 hard-404**: `isTabAllowedForSymbol(symbol, tab)`(`ticker/api.ts`)가 `isCryptoSymbol`
  (DB 멤버십, no-store fetch 없음) 기반 cache-safe 가드. options/financials/fundamental/congress
  페이지가 `if (!(await isTabAllowedForSymbol(upper, '<tab>'))) notFound()`로 crypto를 차단.
- core `MarketSessionSpec` 재배선(`sessionSpecFor.ts`, `e06741fc`) — crypto 24/7 always-open 세션.
- `assetClass`를 chart/news/overall 분석 + 챗 프롬프트로 전달(`useChat.ts`, news/overall actions) →
  crypto가 주식 프레이밍으로 분석되지 않음. crypto news source 분기(`getNewsClient.ts`).
- bars-fetch 실패 시 빈 `BarsData` sentinel seed로 React 19 SSR server-action 에러 방지(`5de87b27`).

### Plan 5 — crypto SEO/discovery/sitemap (PR #622)
- **crypto per-symbol SEO**: `buildCryptoSymbolSeoContent`(시세 프레이밍: title `${displayName}(${ticker})
  시세 분석 — 차트와 매매 신호`, "시세 분석"/"가격 흐름", koreanName 없음), `resolveSymbolSeoContent`가
  assetClass로 crypto/equity 카피 분기(`seo.ts`).
- **JSON-LD about 노드 생략**: crypto는 schema.org 표준 타입 없음 → `buildAssetAboutNode(...,'crypto')`가
  `undefined` → WebPage JSON-LD에서 about 키 생략(`assetClassification.ts`, `page.tsx`).
- **root 카피 일반화**: `SITE_DESCRIPTION`/`ROOT_TITLE`/`ROOT_KEYWORDS`에 "암호화폐/코인/비트코인"
  추가(`seo.ts`). 홈 FAQ에 암호화폐 Q&A, HowTo가 주식+암호화폐로 일반화(`page.tsx`).
- **홈 crypto showcase**: `CryptoShowcase`(`POPULAR_CRYPTOS` 상위 12 칩, `/${symbol}` 링크).
- **검색 crypto 배지**: `TickerAutocomplete`가 `result.marketProfile === 'crypto'`면 "코인" 배지.
- **crypto sitemap**: `/api/sitemap/crypto`(rewrite `/sitemap-crypto.xml`) — popular(`now-1h` rolling
  lastmod, chart/news/fear-greed/overall 4 URL/심볼) + supply-ranked longtail(cap `CRYPTO_LONGTAIL_CAP=1000`,
  `SITE_BUILD_DATE` lastmod). sitemap index에 crypto sub-sitemap 추가(`route.ts`). 캐시 헤더
  `SITEMAP_CACHE_CONTROL = 'public, max-age=3600, stale-while-revalidate=3600'`, DB 실패 시 503 + `Retry-After: 300`.

---

## 2. Test Cases

표기 규약: `<CRYPTO>`는 시드된 crypto 심볼(주 케이스 `BTCUSD`), `<SUBCENT>`는 sub-cent 토큰
(`SHIBUSD`). 모든 PASS 기준은 실측값 단언이며 추측 금지.

### 2.1 curl 케이스 (C#)

| ID | URL / Method | 검증 대상 | PASS 기준 (실측) |
|---|---|---|---|
| **C1** | `GET /BTCUSD` | crypto 차트 페이지 정상 렌더 + crypto 메타 | (1) `200`. (2) `Content-Type: text/html`. (3) HTML `<title>`에 **`시세 분석 — 차트와 매매 신호`** 포함(crypto 카피), `주가 분석` **미포함**. (4) `<link rel="canonical" href="${SITE_URL}/BTCUSD">`(자기참조, trailing path 없음). (5) `<meta property="og:locale" content="ko_KR">`, `og:type=website`, `og:title`에 `| Siglens` 포함. (6) `og:description`에 **`가격 흐름과 매매 신호`** 포함("주가 흐름" 아님). (7) `robots` noindex 태그 **없음**(index 가능). |
| **C2** | `GET /BTCUSD` (JSON-LD 검사) | crypto WebPage JSON-LD about 생략 + breadcrumb/FAQ 존재 | HTML 내 `application/ld+json` 스크립트들 파싱 시: (1) `@type: WebPage` 노드에 **`about` 키가 없음**(crypto는 Corporation about 생략). (2) `@type: BreadcrumbList` 존재, itemListElement = `[Siglens, BTCUSD]` 2단계, 각 `item`이 절대 URL. (3) `@type: FAQPage` 존재. |
| **C3** | `GET /BTCUSD` (캐시 헤더/ISR) | crypto 페이지 ISR 캐시 | 1차 요청 후 2차 요청에서 `x-nextjs-cache: HIT`(또는 `x-vercel-cache`/`Age` 증가)로 정적 캐시 확인. 응답 본문에 `DYNAMIC_SERVER_USAGE` 흔적 없음. (revalidate 21600=6h는 `[symbol]/page.tsx:43`.) |
| **C4** | `GET /BTCUSD/options` | crypto에서 equity-only 옵션 탭 hard-404 | `404`(`isTabAllowedForSymbol(upper,'options')` false → `notFound()`, `options/page.tsx:133`). 응답에 옵션 분석 본문(`Max Pain` 등) **없음**. |
| **C5** | `GET /BTCUSD/financials` | crypto에서 재무제표 탭 hard-404 | `404`(`financials/page.tsx`의 `isTabAllowedForSymbol(upper,'financials')` 가드). |
| **C6** | `GET /BTCUSD/fundamental` | crypto에서 펀더멘털 탭 hard-404 | `404`(`fundamental/page.tsx` 가드). |
| **C7** | `GET /BTCUSD/congress` | crypto에서 의회거래 탭 hard-404 | `404`(`congress/page.tsx` 가드). |
| **C8** | `GET /BTCUSD/news` | crypto 허용 탭 정상 | `200`, `Content-Type: text/html`. crypto는 news 탭 허용(`CRYPTO_DESCRIPTOR.tabs`에 `news` 포함). canonical = `${SITE_URL}/BTCUSD/news`. |
| **C9** | `GET /BTCUSD/fear-greed` & `GET /BTCUSD/overall` | crypto 허용 탭(공탐/종합) 정상 | 둘 다 `200`. crypto descriptor tabs에 포함되어 404 아님. 각 canonical이 해당 경로 자기참조. |
| **C10** | `GET /AAPL` | 주식 페이지 회귀 없음(equity 카피) | (1) `200`. (2) `<title>`에 **`주가 분석`** 포함, `시세 분석` 미포함(equity 카피 `buildSymbolSeoContent`). (3) canonical=`${SITE_URL}/AAPL`. (4) JSON-LD WebPage에 `about` = `{ "@type":"Corporation", "tickerSymbol":"AAPL" }` **존재**(crypto와 대비). |
| **C11** | `GET /AAPL/options` | 주식 옵션 탭 회귀 없음 | `200`(equity는 options 탭 허용). 옵션 시장 있으면 본문 정상; 없으면 `OptionsEmptyState` + `robots: noindex, follow`(soft-404 방지). 어느 경우든 404 아님. |
| **C12** | `GET /sitemap-crypto.xml` (rewrite → `/api/sitemap/crypto`) | crypto sitemap XML | (1) `200`. (2) `Content-Type: application/xml; charset=utf-8`. (3) `Cache-Control: public, max-age=3600, stale-while-revalidate=3600`. (4) 본문이 `<urlset`로 시작하는 valid XML. (5) popular crypto URL 포함 — 최소 `${SITE_URL}/BTCUSD`, `${SITE_URL}/BTCUSD/news`, `${SITE_URL}/BTCUSD/fear-greed`, `${SITE_URL}/BTCUSD/overall`(`buildCryptoPopularEntries`). (6) crypto URL에 `/options`·`/fundamental`·`/financials`·`/congress` 경로 **없음**. |
| **C13** | `GET /sitemap.xml` (rewrite → `/api/sitemap`) | sitemap index에 crypto 포함 | (1) `200`, `Content-Type: application/xml; charset=utf-8`, 동일 `Cache-Control`. (2) `<sitemapindex>` 본문에 **`${SITE_URL}/sitemap-crypto.xml`** `<loc>` 포함(`route.ts:78`). static/popular/longtail sub-sitemap도 함께 존재. |
| **C14** | `GET /robots.txt` | robots 정책 회귀 없음 | (1) `200`. (2) `Sitemap: ${SITE_URL}/sitemap.xml`. (3) `User-agent: *` 그룹 `Allow: /` + `Disallow: /api/`. (4) parasite/AI-training 봇(예 `GPTBot`, `AhrefsBot`) `Disallow: /`. (5) Googlebot/Yeti/Bingbot은 전면 Disallow 그룹에 **미포함**. crypto 전용 robots 규칙 추가 없음(전체 사이트 정책 그대로). |
| **C15** | `GET /` (홈) | crypto showcase + root 카피 + JSON-LD | (1) `200`. (2) HTML에 **`인기 암호화폐`** 섹션 헤딩 + `POPULAR_CRYPTOS` 상위 12개 칩(`<a href="${...}/BTCUSD">` 등) 존재. (3) 홈 FAQ JSON-LD `FAQPage`에 **`암호화폐도 분석할 수 있나요?`** Q와 답변 내 `/BTCUSD` 포함. (4) HowTo JSON-LD `name`에 `미국 주식과 암호화폐` 포함. (5) `<title>`/메타 description이 암호화폐 포함 일반화 카피(`ROOT_TITLE`/`SITE_DESCRIPTION`). |
| **C16** | `GET /api/sitemap/crypto` (DB 장애 시뮬레이션) | crypto sitemap graceful degrade | DB 접근 실패 주입 시 (1) `503`. (2) `Retry-After: 300`. (3) 본문 `Sitemap data temporarily unavailable`. (try-catch, `crypto/route.ts:61-69`). |
| **C17** | `GET /ZZZZZZZ` (존재하지 않는, 형상 유효 심볼) | unknown 심볼 soft-404 정합 | (1) `404`(형상 합격하나 `assetInfo: null` → `notFound`). (2) 메타데이터 noindex(`NOINDEX_SYMBOL_METADATA`: `robots: index=false,follow=false`, `canonical: null`) — robots index 태그와 canonical 자기참조가 **동시 존재하지 않음**(soft-404 충돌 없음). |
| **C18** | `GET /1` 또는 `GET /@@` (형상 불합격 심볼) | 잘못된 형상 차단 | `404`(`isAdmissibleSymbolShape` 실패 → `notFound`). `@@`는 `SYMBOL_EDGE_RE` 불합격, `1`은 단일 digit이나 실재 자산 아님(시드 없으면 404). 응답 noindex. |

### 2.2 브라우저 케이스 (B#) — Chrome 도구, 콘솔 에러 0 필수

| ID | 페이지 / 상호작용 | 기대 렌더 | PASS 기준 (실측) |
|---|---|---|---|
| **B1** | `/BTCUSD` 로드 | crypto 차트 페이지 | (1) 캔들 차트 렌더(빈 화면/스피너 영구 잔존 아님). (2) crypto 탭 바에 **차트·뉴스·공포 탐욕 지수·종합 4개만** 노출, **펀더멘털·재무제표·의회 거래·옵션 미노출**(`tabsFor(crypto)`). (3) fear-greed/overall로 이동 가능한 탭 존재. (4) `read_console_messages`에 error/uncaught 0건. |
| **B2** | `/SHIBUSD` (또는 시드된 sub-cent 토큰) 로드 | sub-cent 가격 정밀도 | (1) 차트 Y축/오버레이 범례 가격이 **2자리 고정이 아니라 동적 자릿수**로 표시(예 `$0.0000xxxx` 형태, `dynamicDecimals`로 leading-zero 보정). `$0.00`처럼 0으로 뭉개지지 않음. (2) 콘솔 에러 0(특히 `Intl.NumberFormat` RangeError 없음 — NaN/Infinity 가드). |
| **B3** | `/BTCUSD` 화면 fear-greed/overall 위젯 | crypto에도 공탐/종합 존재 | fear-greed 점수 위젯과 overall(종합) 결론 영역이 렌더(crypto 허용 탭이라 빈 영역/404 아님). AI 분석 트리거가 crypto 프레이밍(시세/가격)으로 동작, "주가" 강제 프레이밍 아님. 콘솔 에러 0. |
| **B4** | 헤더 검색창에 `BTC` 입력 | crypto 검색 결과 + 배지 | (1) 드롭다운에 BTCUSD 등 crypto 결과 노출(검색이 crypto 머지). (2) crypto 결과 옆에 **"코인" 배지**(`CryptoBadge`, `result.marketProfile === 'crypto'`). (3) 결과 클릭 시 `/BTCUSD`로 이동. (4) 콘솔 에러 0. a11y: combobox role/aria-activedescendant 유지. |
| **B5** | `/` 홈의 "인기 암호화폐" 칩 클릭 | showcase 네비게이션 | (1) "인기 암호화폐" 섹션에 칩 12개 노출. (2) 첫 칩(BTCUSD) 클릭 시 `/BTCUSD`로 이동해 crypto 차트 페이지 정상 렌더. (3) 칩 focus-visible 링 동작(키보드 접근). (4) 콘솔 에러 0. |
| **B6** | `/AAPL` 로드 (회귀) | 주식 페이지 풀 렌더 | (1) 차트 렌더 + 가격 2자리 고정 표시(equity `fixed/2`). (2) 탭 바에 **8개 전체**(차트/뉴스/펀더멘털/재무제표/의회 거래/옵션/공포 탐욕 지수/종합) 노출. (3) 옵션 탭 클릭 시 옵션 페이지 정상(또는 옵션 없으면 EmptyState) — crypto와 달리 404 아님. (4) 콘솔 에러 0. |
| **B7** | `/BTCUSD/options` 직접 접근(주소창) | equity-only 탭 404 UX | Next.js 404(not-found) 화면 렌더, 옵션 본문 없음. 콘솔에 라우팅/하이드레이션 error 0. |

### 2.3 worst / edge / 통합 케이스 (필수)

| ID | 시나리오 | PASS 기준 (실측) |
|---|---|---|
| **C19 (edge)** | `/BTCUSD` 인데 `crypto_assets`에 BTCUSD가 **미시드**(빈 DB) | crypto 미해결 시 `getAssetInfo` null → `assetInfo: null` → `404` + noindex. us-equity로 조용히 fallback해 8탭 노출하는 회귀가 **없어야** 함. (검증 환경 시드 누락 감지용 — 이 케이스가 200/8탭이면 시드 문제이거나 fallback 회귀.) |
| **C20 (edge: degraded)** | `/1INCHUSD`(digit-first) 호출 중 FMP+crypto_assets 동시 다운 시뮬레이션 | `isUnresolvableDegraded('1INCHUSD', true)` = true(`VALID_TICKER_RE` digit-first 불합격) → `404`. 반면 `/MSFT` degraded는 `VALID_TICKER_RE` 합격 → `200` + noindex(기존 거동 보존). |
| **B8 (edge: 빈/degraded crypto 데이터)** | bars fetch 실패한 crypto 심볼 페이지 | 페이지가 500/crash 없이 렌더(빈 `BarsData` sentinel seed, `5de87b27`). 차트 영역은 비거나 fallback이되 React 19 SSR server-action error 콘솔 출력 **없음**. |
| **C21 (edge: 형상 충돌)** | 주식 형상과 충돌 가능한 심볼: `/ADA`(주식 형상) vs `/ADAUSD`(crypto) | `/ADAUSD`는 crypto로 해결되어 crypto 탭(4개)·시세 카피. `/ADA`는 crypto가 아니므로(접미사 없음) us-equity 경로로 해결되거나 미존재 시 404. 두 경로가 서로의 자산클래스로 **오분류되지 않음**(crypto 판정은 `crypto_assets` DB 멤버십 기준). |
| **B9 (edge: sub-cent 포맷 극단)** | `dynamicDecimals` 경계: 매우 작은 값($0.000000xxxx) 표시 | 소수 자릿수가 상한 **12자리**를 넘지 않음(`MAX_DYNAMIC_DECIMAL_PLACES`). 비유한값(데이터 깨짐)에서도 RangeError 없이 2자리로 degrade(`Number.isFinite` 가드). 콘솔 에러 0. |
| **C22 (통합: SEO 카피 비충돌)** | `/BTCUSD`와 `/AAPL`의 title/description 동시 비교 | crypto는 "시세 분석/가격 흐름", equity는 "주가 분석/주가 흐름"으로 **카피가 분기**되고 한쪽 표현이 반대편에 섞이지 않음(`resolveSymbolSeoContent` assetClass 분기). 두 페이지 canonical이 각자 자기 URL. |

---

## 3. 커버리지 / 실행 메모

- 단위(vitest)·E2E(Playwright)가 이미 커버하는 영역(`seo.crypto.test.ts`, `priceFormat.test.ts`,
  `SymbolTabs.test.ts`, `crypto.test.ts` sitemap 등)이라도, 본 케이스는 **prod 빌드 런타임**의
  메타데이터/캐시 헤더/정적 prerender/404 status를 직접 본다(단위가 못 잡는 축).
- curl 케이스의 status/헤더는 `curl -sS -D - -o /dev/null` 또는 `curl -s` 본문 grep으로 실측한다.
- 브라우저 케이스는 매번 `read_console_messages`로 에러 0건을 함께 단언한다(콘솔 에러 = FAIL).
- 멀티엔진(Safari/WebKit)·모바일 뷰포트 교차는 `MULTI_ENV_TESTING.md` 매트릭스로 별도 회차 진행 가능
  (sub-cent 포맷·차트 렌더는 엔진 차에 민감하지 않으나, 탭 가로 스크롤은 모바일에서 확인 권장).
- 실행 결과(PASS/FAIL + 실측 근거)는 본 문서가 아닌 실증 세션 산출물에 기록한다.
