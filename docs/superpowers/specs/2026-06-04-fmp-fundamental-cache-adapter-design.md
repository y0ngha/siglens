# FMP 펀더멘털 캐싱 데코레이터 설계

> 2026-06-04 · FMP 펀더멘털 데이터의 Redis 캐싱을 분석 경로까지 통일하고, key-metrics/ratios 이중 fetch를 제거한다.

## 1. 배경 / 문제

FMP API 사용량 점검에서 `key-metrics-ttm`과 `ratios-ttm`이 **1시간당 각각 ~2,000회(합 ~4,000회)** 호출되는 이상 현상을 확인했다. 코드 추적 결과 두 가지 원인이 드러났다.

### 원인 1 — 분석 경로가 Redis를 우회

펀더멘털 데이터에는 두 진입점이 있는데, 캐싱이 한쪽에만 걸려 있다.

| 진입점 | Redis(`getOrSetCache`) | 비고 |
|---|---|---|
| 펀더멘털 페이지 SSR (`fundamental/page.tsx` → `fundamentalData.ts`) | ✅ 통과 | `fundamental:*` 키 / 1h |
| AI 분석 (`submitFundamentalAnalysisAction`, `submitOverallAnalysisAction` → core) | ❌ **우회** | core `submitFundamentalAnalysis.js:25-40`이 raw `FmpFundamentalClient`를 직접 호출 |

`getFundamentalDataProvider()`가 raw `FmpFundamentalClient`를 반환하고, core가 이 raw provider의 메서드를 직접 호출하므로 분석이 트리거될 때마다 14개 엔드포인트가 캐시 없이 FMP로 직행한다. (분석 *결과* 캐시는 core에 있으나, 그건 입력 데이터를 보호하지 않는다.)

### 원인 2 — key-metrics/ratios 이중 fetch

`FmpFundamentalClient`의 두 메서드가 둘 다 두 엔드포인트를 모두 fetch한다(서로 fallback 병합용):

- `getKeyMetricsTtm()` → `Promise.all([key-metrics-ttm, ratios-ttm])` (`fundamentalClient.ts:133-138`)
- `getRatiosTtm()` → `Promise.all([ratios-ttm, key-metrics-ttm])` (`fundamentalClient.ts:168-173`)

core가 두 메서드를 `Promise.all`로 동시에 부르므로(`submitFundamentalAnalysis.js:27-28`) 같은 요청에서 각 엔드포인트가 2회씩 발사된다. 두 엔드포인트가 항상 쌍으로 나가 호출 수가 **완전 대칭(각 ~2,000)** 인 관측과 일치한다.

### 부수 발견 — 분석 프롬프트의 peer PER/PSR 누락

core `fundamentalPrompt.js:73`은 peer 비교에 `PER ${p.per}, PSR ${p.psr}`를 사용하고 `normalizeFundamentalSnapshot.js:60-63`은 peer input의 per/psr을 읽되 기본값 `null`이다. 그런데 분석 경로가 호출하는 raw `getStockPeers`는 per/psr을 **채우지 않으며**(`fundamentalClient.ts:242-256`), enrich(per/psr 채우기)는 `fundamentalData.ts`(페이지)에만 존재한다. → **현재 AI 펀더멘털 분석의 peer PER/PSR이 항상 N/A로 들어가고 있다.** (회귀 아님, 처음부터 있던 누락.)

## 2. 목표 / 비목표

### 목표
1. 분석 경로와 페이지 SSR이 **동일한 Redis 캐시를 공유**하게 해 FMP 호출을 줄인다.
2. key-metrics/ratios **이중 fetch를 제거**한다(콜드 상태에서도 엔드포인트당 1회).
3. peer enrich를 통일해 **분석 프롬프트의 PER/PSR 누락을 정상화**한다.
4. 기존 캐싱 패턴(`getOrSetCache` + `React.cache`, `fundamental:*` 키, 1h TTL)과 **일관성**을 유지한다.

### 비목표 (이번 범위 밖)
- core의 Redis 사용(분석 결과/브리핑 캐시, Job 큐, 재분석 쿨다운, 채팅 토큰스토어, skills loader)은 **건드리지 않는다**. `docs/SCOPE.md`(:36-38, :218, :280)가 이를 명시적으로 core 책임으로 두고 있으며, 변경 시 core 레포 작업 + SCOPE 재정의가 선행돼야 한다.
- ticker 검색(`/search-symbol`, `/search-name`)은 **최신성 유지를 위해 무캐시로 둔다**(사용자 결정).
- market provider(bars/quote) 캐싱 구조는 변경하지 않는다.
- earnings(`/earnings`)는 no-store + DB 영속 설계를 유지한다.

## 3. 설계

### 3.1 아키텍처 — 캐싱 데코레이터 Provider

기존 팩토리 패턴(`getFundamentalDataProvider()` 싱글톤) 위에 캐싱 데코레이터를 얹는다.

```
getFundamentalDataProvider()
  ├─ prod: new CachedFundamentalProvider( new FmpFundamentalClient() )   ← 변경점
  └─ E2E:  FakeFundamentalDataProvider (그대로, 캐싱 미적용)
```

- **`CachedFundamentalProvider implements FundamentalProvider`** — 생성자에서 raw `FundamentalProvider`(inner)를 위임받는다. 각 메서드를 `getOrSetCache(key, ttl, () => inner.method(...))`로 감싼다.
- 페이지·분석이 둘 다 이 팩토리를 통과하므로 provider 주입만으로 양쪽이 동일 캐시를 공유한다. **core 코드 변경 0.**
- per-request dedup: 생성자에서 각 메서드를 `React.cache`로 한 번 더 감싸(예: `this.getProfile = cache((s) => getOrSetCache(...))`) 같은 요청 내 중복 Redis get을 방지한다. (기존 `barsDataCache`의 `cache(...) + getOrSetCache(...)` 조합과 동일 형태.)

> **패턴 정합성**: bars/market은 "함수 래퍼(`getCachedBarsWithIndicators`)"지만 그건 페이지 전용이다. 분석 경로는 core가 provider를 직접 호출해 함수 래퍼를 끼울 자리가 없으므로, provider 데코레이터가 양쪽을 커버하는 유일한 형태다. 캐싱 헬퍼(`getOrSetCache`)·키 규칙·TTL은 그대로 따른다.

### 3.2 캐시 키 / TTL

`FMP_FUNDAMENTAL_REVALIDATE_SECONDS`(=3600, 1h)를 그대로 사용. 키는 현재 `fundamentalData.ts`·`newsData.ts`의 `fundamental:*` 스킴을 데코레이터로 이관한다.

| 메서드 | 키 | 처리 |
|---|---|---|
| getProfile | `fundamental:profile:<SYM>` | 캐싱 |
| getKeyMetricsTtm | `fundamental:key-metrics:<SYM>` | 캐싱 |
| getRatiosTtm | `fundamental:ratios:<SYM>` | 캐싱 |
| getCashFlowStatement | `fundamental:cash-flow:<SYM>` | 캐싱 |
| getIncomeStatementGrowth | `fundamental:growth:<SYM>` | 캐싱 |
| getFinancialScores | `fundamental:scores:<SYM>` | 캐싱 |
| getStockPeers | `fundamental:peers:<SYM>` | raw peer 목록 캐싱 + enrich(아래 3.4) |
| getAnalystEstimates | `fundamental:estimates:<SYM>` | 캐싱 |
| getGrades | `fundamental:grades:<SYM>` | 캐싱 (페이지·뉴스 공유 키) |
| getGradesConsensus | `fundamental:grades-consensus:<SYM>` | 캐싱 |
| getPriceTargetConsensus | `fundamental:price-target-consensus:<SYM>` | 캐싱 |
| getPriceTargetSummary | `fundamental:price-target-summary:<SYM>` | 캐싱 |
| **getSectorPerformanceSnapshot** | **`fundamental:sector-performance:<DATE>`** | **신규 캐싱** (현재 무캐시, 분석 경로 전용) |
| getEarningsReport(s) | — | **pass-through** (no-store + DB 영속 유지) |
| getHistoricalSectorPerformance | — | pass-through (빈 배열 stub) |

`getOrSetCache`는 값을 envelope으로 감싸 `null`·빈 배열도 캐싱하므로 "데이터 없는 티커"도 재호출되지 않는다(에러는 inner의 fmpGet throw로 set 이전에 전파 → 캐싱 안 됨). 키 정규화는 기존대로 `symbol.toUpperCase()`.

### 3.3 A안 — key-metrics/ratios 이중 fetch 제거

`FmpFundamentalClient` 내부에서 `key-metrics-ttm`·`ratios-ttm` raw fetch를 **공통 헬퍼로 추출하고 `React.cache`로 메모이즈**한다.

```
// 개념
private fetchKeyMetricsRaw = cache((symbol) => getOptionalArray('key-metrics-ttm', { symbol }));
private fetchRatiosRaw     = cache((symbol) => getOptionalArray('ratios-ttm', { symbol }));

getKeyMetricsTtm(symbol) → fetchKeyMetricsRaw + fetchRatiosRaw 로 가공
getRatiosTtm(symbol)     → fetchRatiosRaw + fetchKeyMetricsRaw 로 가공
```

- 같은 요청에서 두 메서드가 호출되면(분석 `Promise.all`, 페이지) raw fetch가 엔드포인트당 1회로 수렴한다.
- 데코레이터의 도메인 키(`fundamental:key-metrics`, `fundamental:ratios`)는 **그대로 유지**한다. 콜드(두 도메인 키 + inner React.cache 모두 미스)에서도 raw는 km-ttm 1회·r-ttm 1회.
- inner의 `fmpGet`은 기존대로 `revalidate: 3600`(Next Data Cache)을 유지한다 — Redis가 미설정/장애일 때의 2차 방어선.

> `React.cache`는 요청 스코프(RSC 렌더 + Server Action 호출 각각)로 동작하므로 분석 Server Action 경로에서도 유효하다.

### 3.4 peer enrich 통일

peer per/psr enrich 루프를 **`fundamentalData.ts`에서 `CachedFundamentalProvider.getStockPeers`로 이관**한다.

- `getStockPeers(symbol)`: raw peer 목록을 `fundamental:peers:<SYM>`에 캐싱한 뒤, 각 peer에 대해 `this.getKeyMetricsTtm(peer.symbol)`(이제 캐싱됨)을 호출해 `per`/`psr`을 채워 반환한다.
- enrich는 콜드 캐시 시 peer당 추가 호출을 막기 위해 **순차 실행**(기존 `fundamentalData.ts` 주석의 rate-limit 회피 정책 유지). warm 캐시에서는 `getKeyMetricsTtm` 히트로 저렴하다.
- 결과: 분석 경로도 enrich된 peer를 받아 프롬프트 PER/PSR이 정상 채워진다. core는 `FundamentalPeerInput`의 per/psr(optional)을 이미 소화하므로 호환된다.

### 3.5 호출부 정리

- **`fundamentalData.ts`**: 내부 `getOrSetCache` 래핑과 enrich 루프를 데코레이터로 이관한다. export 함수는 `provider.method(symbol)`를 호출하는 얇은 래퍼로 축소(또는 provider를 직접 노출). `getProfileDescriptionKo`의 DB 번역 로직은 유지하되 내부 `getProfile`은 캐싱된 provider 메서드를 부른다.
- **`newsData.ts`**: `getGradeEvents`의 `fundamental:grades` `getOrSetCache` 래핑을 제거하고 `provider.getGrades(symbol)`(데코레이터 캐싱)를 호출한다. 페이지·뉴스가 동일 키를 공유한다. `getEarningsReportComparison`(DB-first)은 그대로.

## 4. 영향받는 파일

| 파일 | 변경 |
|---|---|
| `src/shared/api/fmp/CachedFundamentalProvider.ts` | **신규** — 데코레이터 + 키 빌더 + enrich |
| `src/shared/api/fmp/getFundamentalDataProvider.ts` | prod에서 데코레이터 반환 |
| `src/shared/api/fmp/fundamentalClient.ts` | km-ttm/r-ttm raw fetch를 React.cache 헬퍼로 추출 |
| `src/app/[symbol]/fundamental/fundamentalData.ts` | getOrSetCache·enrich 제거, provider 위임 |
| `src/app/[symbol]/news/newsData.ts` | getGradeEvents의 getOrSetCache 제거, provider 위임 |
| `src/shared/api/fmp/__tests__/CachedFundamentalProvider.test.ts` | **신규** — 캐시 히트/미스, 키, enrich, pass-through |
| `src/shared/api/fmp/__tests__/fundamentalClient.*.test.ts` | km/r 단일 fetch 검증 추가 |

## 5. 테스트 전략

- **CachedFundamentalProvider**: ① 캐시 미스 시 inner 1회 호출 + set, ② 히트 시 inner 미호출, ③ 키 포맷(대문자 정규화, sector-performance는 DATE 키), ④ null/빈 배열 캐싱, ⑤ earnings/historical pass-through(캐싱 안 함), ⑥ Redis 미설정 시 graceful fallback(inner 직접). fake Redis/inner mock 사용.
- **fundamentalClient (A안)**: `getKeyMetricsTtm`+`getRatiosTtm`를 같은 요청에서 호출 시 `key-metrics-ttm`·`ratios-ttm` fetch가 각 1회인지(mock fetch 호출 수 검증).
- **enrich**: getStockPeers 결과의 per/psr이 각 peer의 keyMetrics에서 채워지는지, 순차 호출인지.
- **회귀**: 페이지·뉴스가 동일 grades 키를 공유해 한쪽 워밍이 다른 쪽에 반영되는지.

## 6. 위험 / 완화

| 위험 | 완화 |
|---|---|
| 분석 경로 enrich 추가로 콜드 시 peer당 `getKeyMetricsTtm` 호출 증가 | 캐싱 공유(페이지 워밍 재사용) + 순차 실행. 순효과는 PER/PSR 정상화 + 전체 호출 급감(우회 제거)이 압도 |
| `React.cache`가 Server Action에서 기대대로 동작하지 않을 가능성 | 요청 스코프 동작 확인 + 테스트로 fetch 호출 수 검증 |
| 데코레이터/E2E Fake 경로 분기 누락 | E2E는 Fake 그대로(캐싱 미적용) — 팩토리 분기 유지, E2E 스위트로 검증 |
| 키 스킴 변경 없음이지만 newsData↔fundamentalData grades 키 공유로 인한 미묘한 동작 차이 | 동일 키이므로 동작 동일. 테스트로 확인 |

## 7. 검증 방법

1. `yarn test` — 신규/수정 테스트 통과.
2. `yarn build` + 로컬 실행 — 펀더멘털 페이지·AI 분석 동작 확인.
3. 배포 후 FMP 사용량 대시보드에서 `key-metrics-ttm`·`ratios-ttm` 시간당 호출 수 급감 확인(콜드 종목당 1회 + 분석/페이지 캐시 공유).
4. 분석 결과 프롬프트(또는 로그)에서 peer PER/PSR이 N/A가 아닌 실제 값으로 채워지는지 확인.

## 8. 향후 (별도 결정 필요)

- core의 분석 결과 캐시/Job 큐/쿨다운을 siglens로 이전할지 여부 — SCOPE.md 재정의 + core 레포 작업으로 별도 프로젝트화.
- ticker 검색 사용량이 별도 폭증원인지 모니터링.
