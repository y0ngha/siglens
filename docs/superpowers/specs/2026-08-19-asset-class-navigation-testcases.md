# 3자산군 동선 재편 — 테스트 케이스 인벤토리

설계 문서: [`2026-08-19-asset-class-navigation-design.md`](./2026-08-19-asset-class-navigation-design.md)
브랜치: `feat/asset-class-navigation`

이 문서는 **무엇이 검증되는지**를 한 곳에 모은다. 목적은 두 가지다.

1. 요구 항목 6개가 각각 어떤 케이스로 덮이는지 추적한다.
2. 자동 테스트로 **덮이지 않는** 것을 명시한다 — 실증(curl/Chrome)으로만 확인되는
   항목을 적어 두지 않으면 "테스트 다 통과했으니 됐다"는 착각이 남는다.

---

## 0. 규모

| 구분 | 파일 | 케이스 |
|---|---:|---:|
| 유닛·컴포넌트 (`src/**`) | 97 | 943 |
| E2E (`e2e/specs/**`) | 8 | 52 |
| **합계(이 브랜치에서 추가·변경)** | **105** | **995** |

전체 스위트: **1,076 파일 / 10,060 케이스 통과**(2 skip은 `model-gate`의 의도된
placeholder — `project_model_gate_skips_intentional` 참조).

게이트 상태: `yarn test` 통과 · `yarn typecheck` 0 · `yarn lint` 0 · `yarn build` exit 0
· react-doctor 84(master와 동일 — 회귀 없음, 90 목표는 미달로 별도 보고).

### 0.1 2라운드 감사에서 추가된 커버리지

5종 Opus 5 감사 2라운드가 지적한 "scope/country가 소스에는 흐르는데 테스트는
`'us'`/`'US'`만 넘긴다"는 패턴을 일괄 보강했다. 각 항목은 **비-기본값을 넘기고
그것이 아래층까지 전달되는지**를 단언한다.

| 대상 | 잡히는 변이 |
|---|---|
| `useEconomicCalendarTrigger` | `ensureEconomicCalendarAction(country)` → 인자 삭제 |
| `listInRange` / `listUnanalyzedAnnounced` | `eq(country)` 삭제 |
| `getMarketSummaryClientAction` / `submitMarketBriefingAction` / `getSectorSignalsAction` | `dashboardScopeOf(scope)` → `dashboardScopeOf('us')` |
| `getSectorSignalsAction` 롤링 shim | 단일 timeframe 인자 호출 분기 삭제 |
| `getCalendarFromDb` | 국가별 리더 Map이 국가를 키로 쓰지 않음 |
| `calendarRefreshFlag` / `calendarAnalysisRefreshFlag` | 키 접미사 `:${country}` → `:us` 고정 |
| `marketSummaryCache` / `sectorSignalsCache` | Redis 키의 `scope.id` → `'us'` 고정 |
| `sessionSpecForDashboardScope` / `dashboardCacheTtlSeconds` | KR 세션 분기·5분 하한 삭제 |
| `marketFearGreedKrCache` | 조회 상한을 US 세션으로, TTL을 24h로 |
| `marketFearGreedKrStaticCache` | `React.cache` 래퍼 삭제 |
| `getKrIndicatorCards` | ISR 태그를 미국 태그로 |
| `useSectorSignalState` | `useSectorSignals(scope.id, …)` → `'us'`; `?sector=` scope 검증 삭제 |
| `MarketSummaryPanel` | `linkSectorCards` 무시(한국 페이지가 크롤 진입점 6개를 염) |
| `/api/analysis/stream` | briefing이 `params.scope`가 아닌 키를 읽음 |
| `buildStaticEntries` | `/fear-greed/kr` lastmod가 NYSE 마감을 씀 |
| `EconomicCalendarGrid` | 빈 상태 문구를 "미국"으로 하드코딩 |
| `BriefingCard` | scope에 없는 티커·근거 없는 VIX를 그대로 렌더 |
| `IndexCard` / `SignalStockCard` | 통화 기호를 `$`로 하드코딩 |
| `RegionTabs` | 지역 하위 페이지에서 지역 탭을 현재 페이지로 표기 |
| `CategoryCard` | 앵커 텍스트가 `더보기`뿐(키워드 신호 0) |

---

## 1. 항목별 커버리지 매트릭스

### 항목 1 — 뉴스 동선 (미국/한국/암호화폐 직행)

| 대상 | 파일 | 대표 케이스 |
|---|---|---|
| 내비 단일 소스 | `src/shared/config/__tests__/assetClassNav.test.ts` | 버티컬·지역 스키마 불변식, `regionsOf`, `ALL_NAV_REGION_LINKS` 중복 없음 |
| 헤더 트리 파생 | `src/widgets/layout/__tests__/headerNavTree.test.ts` | `overview`는 `rootHref`가 지역에 없을 때만 생김 |
| 활성 상태 판정 | `src/widgets/layout/__tests__/navActiveState` (트리 테스트 내) | `/market`이 `/market/kr`의 접두사라 **정확 일치만** 활성 |
| 데스크톱 드롭다운 | `src/widgets/layout/__tests__/HeaderNavMenu.test.tsx` | 클릭 토글 / 마우스 호버 열림 / **터치는 호버로 안 열림** / Escape + 포커스 복귀 / 바깥 pointerdown / 링크 클릭 시 닫힘 / 닫혀도 링크가 DOM에 남음 / `aria-current`는 정확 일치 1개 |
| 모바일 드로어 | `src/widgets/layout/__tests__/HeaderMobileMenu.test.tsx` | 선언된 모든 목적지(overview 포함)가 드로어에 존재, 닫힘 시 `aria-hidden` |
| 지역 탭 | `src/shared/ui/__tests__/RegionTabs.test.tsx` | 활성 지역은 링크가 아니라 `aria-current` span |
| 허브 페이지 | `src/app/news/__tests__/page.test.tsx` | 3지역 딥링크 SSR, canonical `/news`, h1·breadcrumb·title 이름 일치 |
| 미국 허브 | `src/app/news/us/__tests__/page.test.tsx` | self-canonical, 구 질의 키워드 승계 |
| 카테고리 페이지 | `src/app/news/[category]/__tests__/page.test.tsx` | `/news/kr` 유효 슬러그·h1 `한국 증시 뉴스`·지역 탭 활성 |
| 뉴스 소스 라우팅 | `src/entities/market-news/__tests__/getMarketNewsClient.test.ts` | `kr` → NAVER, 나머지 → FMP, 소스별 싱글턴 분리 |
| NAVER 클라이언트 | `src/entities/market-news/__tests__/naverMarketNewsClient.test.ts` | 질의 합집합(URL 기준 dedupe), 마크업 제거, 자격증명 없음 → 빈 결과 + 로그 |

### 항목 2 — 한국 공포·탐욕 지수

| 대상 | 파일 | 대표 케이스 |
|---|---|---|
| 심볼 테이블 | `src/entities/market-fear-greed/__tests__/marketFearGreedKrSymbols.test.ts` | core의 의미론적 시리즈 키 6종에 모두 매핑 |
| 실현변동성(VKOSPI 대체) | `.../realizedVolatility.test.ts` | 로그수익률 표본표준편차 ×√252×100, 창 미달 시 빈 시리즈 |
| 종가 수집 | `.../lib/fetchKrDailyCloses.test.ts` | KST 달력일 변환, UTC 자정 넘는 인스턴트, null/0/NaN/무일자 행 제거, **행 0개면 throw**(조용한 빈 배열 금지), E2E fixture 경로 |
| 뷰 캐시 | `.../marketFearGreedKrCache.test.ts` | fingerprint 구성, 표본 부족 시 `snapshot: null` |
| 정적 캐시 | `.../api/marketFearGreedKrStaticCache.test.ts` | `revalidate=3600`, 태그 `market:fear-greed:kr`(미국과 분리), 키 prefix 분리, 에러 전파 |
| 라우트 | `src/app/fear-greed/kr/__tests__/page.test.tsx` | degrade 시 canonical null + noindex, 본문과 metadata 판정 일치 |

### 항목 3 — 한국 시장 분석 `/market/kr`

| 대상 | 파일 | 대표 케이스 |
|---|---|---|
| scope 묶음 | `src/shared/config/__tests__/dashboardScope.test.ts` | `sectorGroups.symbols ⊆ sectorEtfs`, `sectorStocks.sectorSymbol ⊆ signalSectors`, 알 수 없는 id는 throw |
| provider 라우팅 | `src/shared/api/market/__tests__/marketDataProviderFor.test.ts` | **kr → yahoo**, us → FMP, kr provider 싱글턴 |
| 요약 캐시 | `src/entities/market-summary/__tests__/marketSummaryStaticCache.test.ts` | 키 `[.., 'kr', fingerprint]`·태그 `market:summary:kr`, provider 팩토리에 `'kr'` 전달 |
| 신호 캐시 | `src/entities/sector-signal/__tests__/sectorSignalsStaticCache.test.ts` | 동일 + timeframe 축 |
| 본문 배선 | `src/app/market/__tests__/page.test.ts` | `MarketContent`를 KR scope로 호출 시 로더·쿼리 키·`peekBriefingStatic`이 전부 `kr` |
| 라우트 | `src/app/market/kr/__tests__/page.test.ts` | KR scope만 사용, self-canonical, 두 로더 모두 비면 noindex |
| 통화 기호 | `IndexCard.test.tsx` / `SignalStockCard.test.tsx` | **`₩`가 그대로 렌더되고 `$`가 남지 않는다** (실증으로 발견한 `$268,500` 회귀) |

### 항목 4 — 홈 히어로 퀵링크

| 대상 | 파일 | 대표 케이스 |
|---|---|---|
| 파생 규칙 | `src/widgets/home/__tests__/heroQuickLinks.test.ts` | `NAV_VERTICALS`에서 파생, `시장 분석`만 지역 전개, 나머지는 첫 지역 1개, 허브(`/news`)를 가리키지 않음 |
| 자산군 문구 | `src/app/__tests__/supportedAssets.test.ts` | 홈·뉴스 허브 카피가 미국·한국·암호화폐를 모두 명시 |

### 항목 5 — 한국 경제 `/economy/kr`

| 대상 | 파일 | 대표 케이스 |
|---|---|---|
| 지표 정의 | `src/shared/config/__tests__/economyIndicatorsKr.test.ts` | FMP 이벤트명 키 유일성, `normalizeKrEventName`의 기간 괄호 제거 |
| 국가별 정규화 | `src/shared/api/fmp/__tests__/normalizeCalendarForCountry.test.ts` | `country`를 인자로 받아 US 하드코딩을 제거 |
| 저장소 | `src/entities/economy/api/__tests__/economicCalendarRepository.test.ts` | `listAnnouncedSince(country, from)`가 국가·시작일로 거르고 `actual === null` 행을 버림 |
| 지표 카드 | `.../getKrIndicatorCards.test.ts` | 직전 발표 대비 변화, 발표 1건이면 `null`, 발표 없는 지표는 제외, DB 실패 시 빈 배열 |
| 국가별 캐시·플래그 | `.../getCalendarFromDb.test.ts`, `.../calendarAnalysisRefreshFlag.test.ts` | country별 `unstable_cache` 래퍼와 Redis 키 분리 |
| 라우트 | `src/app/economy/kr/__tests__/page.test.tsx` | 지표·캘린더가 모두 비어야 degrade, **캘린더는 항상 렌더**(인제스션 트리거 마운트) |

### 항목 6 — AI 분석 정상 동작

| 대상 | 파일 | 대표 케이스 |
|---|---|---|
| 다이제스트 액션 | `src/entities/market-news/__tests__/submitMarketNewsDigestAction.test.ts` | 카테고리별 캐시 키 스코핑 |
| 브리핑 액션 | `src/entities/market-summary/__tests__/submitMarketBriefingAction.test.ts` | scope별 분리 |
| 스트림 라우트 | `src/app/api/analysis/stream/__tests__/route.test.ts` | 프로바이더 선택 경로 |

> 항목 6의 실제 원인(`DEEPSEEK_API_KEY` 누락)은 **환경 설정**이라 코드 테스트로 잡히지
> 않는다. 회귀 방지는 배포 파이프라인(SSM 주입)과 CloudWatch 알람이 담당한다.

### 횡단 — 사이트맵·SEO

| 대상 | 파일 | 대표 케이스 |
|---|---|---|
| 정적 엔트리 | `src/entities/sitemap-entry/__tests__/buildStaticEntries.test.ts` | 신규 5개 URL 포함, `/news/*` 지역 링크는 카테고리 엔트리와 중복되지 않음, `/fear-greed/kr` lastmod는 **KRX** 직전 마감 |
| 카테고리 SEO | `src/app/news/[category]/__tests__/seo.test.ts` | 지역별 키워드, degrade 시 noindex+follow |

---

## 2. E2E (`e2e/specs/asset-class-nav.spec.ts`, 신규)

| 그룹 | 케이스 |
|---|---|
| 신규 라우트 | 5개 URL이 200 + 자기 시장 h1 / 한국 페이지 h1에 `미국` 미포함 |
| 지역 탭 | 활성 지역은 `aria-current` 텍스트(링크 아님) / 탭으로 왕복 / 암호화폐는 뉴스에만 존재 |
| 헤더 드롭다운 | 닫힌 상태에서도 신규 링크 5종이 DOM에 존재 / 트리거 클릭으로 열림 → 한국으로 이동 / Escape로 닫히고 포커스 복귀 / 뉴스는 미국 카테고리까지 한 번에 노출 |
| 시장 격리 | `/market/kr` → `/market` 이동 후 미국 데이터만 보임(`코스피` 미포함) |
| 홈 동선 | 히어로 퀵링크가 허브가 아니라 최종 목적지를 가리킴 |

수정된 기존 스펙 2건(라벨 축약에 따른 셀렉터 갱신):
- `e2e/specs/market-fear-greed.spec.ts` — `미국 공포·탐욕 지수` 단일 링크 → `공포·탐욕 지수` 트리거 + 패널 안 `미국`
- `e2e/specs/header-mobile-nav.spec.ts` — `미국 경제` → `경제` 그룹 안 `미국`
  (이 때문에 드로어 그룹에 `role="group" aria-labelledby`를 붙였다 — 지역 라벨이
  짧아져 스크린리더에는 같은 이름의 링크가 반복되던 문제도 함께 해결)

`e2e/setup/seed.ts`에 `country: 'KR'` 캘린더 6행 추가(지표 3종 × 2회 발표) —
`changeFromPrevious`까지 렌더되어야 카드가 실제 모양을 갖춘다.

---

## 3. 자동 테스트로 덮이지 않는 것 (실증 전용)

| 항목 | 왜 자동화 밖인가 | 검증 방법 |
|---|---|---|
| 실데이터 정확성 | E2E는 FMP 키 없이 도는 것이 의도된 설계 | 프로덕션 유사 빌드 + 실제 자격증명으로 curl·Chrome |
| NAVER 검색 품질 | 외부 랭킹은 결정적이지 않음 | 실측(2026-08-17: `sort=sim` 제목 적중률 90~98%) |
| 모바일 레이아웃 | Chrome 창은 ~762px 아래로 못 줄어듦 | Playwright 375px 뷰포트 + 가로 오버플로 단언 |
| ISR cold-gen | 빌드/개발 서버에서 재현 안 됨 | 프로덕션 배포 후 첫 요청 실증 |
| 롤링 배포 중 Server Action 호환 | 단일 컨테이너 테스트로는 불가 | 배포 후 30분 오버랩 구간 에러율 관측 |
| CDN 캐시 거동 | 오리진 테스트로는 안 보임 | `cf-cache-status`를 **GET**으로 측정 |

---

## 4. 실증 체크리스트

### 4.1 curl (프로덕션 유사 빌드)

각 URL에 대해 상태코드 200, `<h1>` 문자열, canonical, `robots` 메타를 확인한다.

```
/                /news            /news/us         /news/kr
/news/crypto     /market          /market/kr       /fear-greed
/fear-greed/kr   /economy         /economy/kr      /sitemap.xml
```

역방향(누수) 확인: `/market`·`/fear-greed`·`/economy` 응답에 `코스피`/`한국`이
섞이지 않을 것.

### 4.2 Chrome (데스크톱 1280px)

- 헤더 4개 버티컬 호버 → 패널 열림, 지역·카테고리 링크 도달
- 각 신규 페이지 실데이터 렌더(지수·게이지·카드)
- 지역 탭 왕복

### 4.3 모바일 (Playwright 375px)

- 햄버거 → 드로어 그룹 4개가 제목 크기·구분선으로 구분되는지
- 가로 오버플로 0
- 드로어 링크로 신규 페이지 도달 후 드로어가 닫히는지
