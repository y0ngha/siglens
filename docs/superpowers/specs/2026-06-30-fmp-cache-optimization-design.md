# FMP 호출·egress 절감 캐시 개선 — 설계

- 작성일: 2026-06-30
- 스코프: siglens I/O 레이어 (`shared/api/fmp/*`, `shared/api/market/*`, `app/[symbol]/fundamental/*`)
- core(`@y0ngha/siglens-core`) **무변경**
- 상태: 설계 승인 대기

---

## 1. 배경 (실측)

FMP 사용량 대시보드(15분 윈도우) 기준 총 ~1,558 calls / ~10.6 MB. 두 영역이 비용을 지배한다.

| 영역 | 수치 | 비중 | 코드 근거 |
|---|---|---|---|
| **valuation**: `key-metrics-ttm` + `ratios-ttm` | 각 383 calls | 호출 49% | `fundamentalClient.ts:150-156`(쌍 fetch), `CachedFundamentalProvider.ts:169-196`(peer enrich fan-out) |
| **EOD**: `historical-price-eod/full` | 117 calls / 6.59 MB | egress 62% | `FmpMarketProvider.ts:191-212`, `config.js`(장중 TTL 60s) |

근본 원인(코드 확인):

1. **valuation fan-out** — `CachedFundamentalProvider.getStockPeers`(cold)가 peer 최대 `PEER_LIMIT=10`개에 대해 `getKeyMetricsTtm(peer)`를 호출하고, 각 호출은 `getValuationRaw`로 `key-metrics-ttm` + `ratios-ttm`을 **쌍으로** fetch한다. cold peer 목록 1개 = 최대 1(stock-peers) + 10×2 = 21 FMP 호출.
   - **그런데 페이지(`PeersTable.tsx:35-67`)는 per/psr을 렌더하지 않는다**(컬럼: 티커·회사명·시총, 모두 raw `stock-peers`에서 옴). peer per/psr의 유일한 소비처는 **FactLayer(AI 분석 프롬프트)** — core `submitFundamentalAnalysis` → `fundamentalPrompt`의 `PER ${p.per}, PSR ${p.psr}`. → **페이지 enrich는 순수 낭비.**
2. **EOD 재fetch** — 일봉 캐시 TTL은 장중 60s(`computeBarsEffectiveTtl`, `BARS_OPEN_TTL_SECONDS=SECONDS_PER_MINUTE`). 과거 730일(`TIMEFRAME_LOOKBACK_DAYS['1Day']`)은 불변인데도 60초마다 통째(~115KB) 재fetch된다. 바뀌는 건 오늘 봉뿐이고 그건 이미 `fetchTodayQuoteBar`(quote)가 담당.

### 사용자 신선도 (불변 보장)

- **가격·등락률·공탐**: 클라 React Query refetch 30s(`useBars.ts:30`, `BARS_STALE_TIME_MS=30_000`). 본 설계와 무관, 항상 최신.
- **valuation/재무/peer**: SSR + ISR 전용(클라 refetch 없음). fundamental 페이지 `revalidate=86400`(24h) + 섹션별 `staticSymbolCache`(24h). 즉 **사용자가 보는 재무 신선도 상한은 이미 24h**다.

---

## 2. 목표 / 비목표

### 목표
1. valuation FMP 호출 대폭 절감(특히 peer fan-out 제거).
2. EOD egress·호출 급감(불변 과거를 거래일당 1회만 fetch).
3. 사용자 화면·SEO·FactLayer 품질 **무손상**.
4. 기존 캐싱 패턴(`getOrSetCache` + `React.cache`, poison 방지, graceful fallback) 일관 유지.

### 비목표 (이번 스코프 제외 — 별도 백로그)
- **SWR(stale-while-revalidate)** — `getOrSetCache`에 soft-TTL 백그라운드 갱신. 전역 캐시 품질 업그레이드지만 범위 외.
- **음성 캐시(empty marker)** — 무효 심볼 반복 miss(3% Bad Request) 차단. earnings의 `markEarningsEmpty` 패턴. 범위 외 → **3% Bad Request는 이번에 미해결**.
- **DCF/durable DB 티어**, **FMP 플랜 업그레이드**, **클라 전송 페이로드 trim**(별도 백로그 `indicator-payload-waste`).

### 기각된 대안 (검토 후 제외)
- **배치/벌크 엔드포인트**: 실측 결과 `key-metrics-ttm?symbol=AAPL,MSFT` → 빈 배열(다중심볼 미지원), `batch-quote`·`key-metrics-ttm-bulk`·`ratios-ttm-bulk`·`scores-bulk` 등 → **HTTP 402 Restricted**(현재 플랜 미제공). `market-capitalization-batch`만 동작하나 per/psr 없음. → valuation 배치 불가.
- **봇 enrich 스킵(G1)**: 페이지가 ISR/`staticSymbolCache`라 봇이 cold-gen을 트리거하면 비-enrich 결과가 24h 고정돼 사람에게도 노출(캐시 포이즌). 채택 안 함.
- **전역 cache-only enrich(Y)**: fan-out은 제거하나 분석 경로 cold peer가 null → FactLayer 품질 소폭 저하. X안이 우위.

---

## 3. 설계

### 변경 1 — Valuation TTL 1h → 24h

- `fundamentalClient.ts:45` `FMP_FUNDAMENTAL_REVALIDATE_SECONDS = SECONDS_PER_HOUR` → `SECONDS_PER_DAY`.
- 이 단일 상수가 두 계층을 동시에 구동한다: (a) Next Data Cache `revalidate`(`fmpGet` opts), (b) Redis TTL(`CachedFundamentalProvider`의 모든 `fundamental:*` 키, `CachedFundamentalProvider.ts:26` `TTL`).
- **효과**: 분석 경로 valuation + cross-deploy Redis 버퍼가 24h. 배포(`unstable_cache`=Next Data Cache가 buildId별로 리셋)에도 Redis(24h)가 버텨 FMP 직격 방어.
- **사용자 영향 0**: 페이지는 이미 `staticSymbolCache` 24h. 본 종목 PER/PSR(`ValuationCard` ← `getKeyMetricsTtm(symbol)`)도 그 캐시 안. 분석 PER은 가격종속이나 분석은 별도 차트가격(클라 30s)을 쓰고 재무는 분기 단위라 24h 지연 수용 가능.
- **정합**: `FMP_STATEMENTS_REVALIDATE_SECONDS`·`CONGRESS_REVALIDATE_SECONDS`는 이미 `SECONDS_PER_DAY`(`time.ts:24-25`).
- earnings는 `getEarningsReports`의 `no-store`(`fundamentalClient.ts:426-427`) 그대로.
- **검증**: 이 상수는 route segment config(`export const revalidate`)로 쓰이지 않으므로(사용처 = 위 2곳뿐) 리터럴 강제 규칙(MISTAKES §15)과 무관.

### 변경 2 — Peer enrich split (X안)

페이지는 raw peer(enrich 없음), 분석(FactLayer)만 enriched peer.

- **추가 메서드** `getStockPeersRaw(symbol): Promise<FundamentalPeerInput[]>`:
  - **인터페이스 분리**(타입 정합): 기존 `FundamentalProvider`(= inner/raw client 계약)는 **그대로 두고**, 소비자용 확장 인터페이스 `FundamentalProviderWithRawPeers extends FundamentalProvider { getStockPeersRaw }`를 `fundamentalProvider.types.ts`에 추가한다. `FundamentalProvider`에 직접 추가하면 inner(`FmpFundamentalClient`)도 구현이 강제되므로 분리한다 — `FmpFundamentalClient` 무변경 유지.
  - `CachedFundamentalProvider`가 `FundamentalProviderWithRawPeers`를 구현(constructor inner 타입은 `FundamentalProvider` 그대로). 구현: `getOrSetCache('fundamental:peers-raw:<SYM>', TTL, () => this.inner.getStockPeers(symbol))` — **enrich 루프 없음**. inner의 raw `getStockPeers`(티커·회사명·시총, per/psr 미설정)를 그대로 캐싱.
  - `getFundamentalDataProvider` 반환 타입을 `FundamentalProviderWithRawPeers`로 변경.
  - `FakeFundamentalDataProvider`(E2E)에도 `getStockPeersRaw` 추가(팩토리가 Fake를 이 타입으로 반환).
- **페이지 전환**: `fundamentalData.ts`의 `getStockPeers`(페이지 PeersSection이 사용)를 `fundamentalClient.getStockPeersRaw` 위임으로 변경. PeersTable 렌더는 동일(컬럼 3개) → **페이지 fan-out 완전 제거, 화면·SEO 변화 0**.
- **분석/FactLayer 불변**: core 포트 `getStockPeers`(enriched)는 그대로 유지. core `submitFundamentalAnalysis`가 이를 호출해 per/psr을 받는다(2026-06-04 스펙이 정상화한 동작 — **회귀 금지**). 변경 1(24h)로 peer valuation도 대부분 캐시 hit.
- **순효과**: valuation fan-out이 "페이지(낭비) + 분석"에서 **"분석만(봇 skipEnqueue, 실수요)"**으로 축소.
- **검증**: 전환 후 enriched `getStockPeers` 호출처 = core 분석 경로뿐(페이지·news·overall 등 다른 소비자 없음 — grep 확인).

### 변경 3 — EOD 캐시 분리 (1Day)

불변 과거 EOD를 long-TTL로, 최근 구간(오늘 봉 포함)은 live로 분리한다. **핵심: core 포트 `getBars`를 날짜 윈도우만 달리해 2번 호출**하므로 `FmpMarketProvider`·core 무변경 — 캐싱·결합은 전부 `CachedMarketDataProvider`에 둔다(어댑터 순수성 유지).

- **2-윈도우 분리**(`CachedMarketDataProvider`, timeframe=`1Day` & `before===undefined`일 때만):
  - **과거(불변)**: `inner.getBars({ ...options, before: histTo })` — `before`(=endDate) 지정이면 `FmpMarketProvider.getDailyBars`가 오늘 봉을 붙이지 않음(`endDate === undefined ? fetchTodayQuoteBar : null`, `FmpMarketProvider.ts:201-204`). `historical-price-eod/full`이 `to=histTo`로 한정돼 불변. → long-cache.
  - **최근(live)**: `inner.getBars({ ...options, from: recentFrom })` — 작은 EOD(~10일) + 오늘 봉(quote). → 기존 짧은 TTL(`computeBarsEffectiveTtl`, 장중 60s).
  - **결합**: `mergeBarsByTime(hist, recent)` — time 기준 오름차순 dedup(겹치는 구간은 recent 우선). 순수 함수.
- **윈도우 경계**(겹침으로 주말·공휴일·DST 갭 방지): `histTo = today−7d`, `recentFrom = today−10d`(약 3일 overlap → dedup). `from`(now−730d)은 호출자 값 유지. 날짜는 `YYYY-MM-DD`로 절단해 일 단위 self-versioning.
- **캐시 키/TTL**:
  - 과거: `bars:eodhist:<SYM>:<from>:<histTo>` — `from`·`histTo`가 매 거래일 변경 → self-versioning. `LONG_TTL = SECONDS_PER_DAY * 2`.
  - 최근: `bars:eodrecent:<SYM>:<recentFrom>` — 기존 세션별 TTL(장중 60s).
- **1Day 외**(인트라데이, `before` 지정된 과거 페이지네이션)는 기존 `bars:raw` 60s 단일 경로 그대로.
- **결합 결과는 기존 indicator 캐시(`barsDataCache` `bars:<SYM>` 60s) 그대로 통과** → 지표 신선도·오늘 봉 무영향. 분리 전후 **결합 시리즈 동일**(단일 `getBars(from=now−730d)`와 같은 집합).
- **효과**: 730일 EOD(~115KB)는 거래일당 1회/심볼. 최근(~10행) + quote만 60s. egress·EOD 호출 급감, quote(live tail)는 ~유지.
- **사용자 영향 0**: 오늘 봉/가격은 최근 윈도우(live 60s) + 클라 30s 그대로.
- **고려**: hist(~115KB) 2일 보관 → Redis 저장 소폭↑(허용). `now` 기준 윈도우는 `new Date()`로 산출, 테스트는 `vi.setSystemTime`로 결정화. E2E는 `getCachedMarketDataProvider`가 raw provider를 반환(Cached 우회)하므로 영향 없음.

---

## 4. 에러 처리 (기존 계약 보존)

- FMP throw는 캐시 `set` 전에 전파 → 장애 미캐싱(poison 방지). (`getOrSetCache.ts:58`)
- 빈 결과는 `shouldCache` 가드로 미캐싱(빈 봉/null). (`CachedMarketDataProvider.ts:64,72`)
- Redis 미설정/장애 시 `getOrSetCache`가 fetcher 직접 호출로 graceful fallback. (`redisClient.ts:45-50`)
- 페이지 섹션 degrade(`.catch` → `[]`/`null`) 유지. (`page.tsx` PeersSection/ValuationSection)

---

## 5. 테스트

### 변경 1
- `FMP_FUNDAMENTAL_REVALIDATE_SECONDS === SECONDS_PER_DAY` 단언.
- `fmpGet` revalidate 인자·`getOrSetCache` ttl 인자가 24h로 전달되는지.

### 변경 2
- `getStockPeersRaw`가 `getKeyMetricsTtm`을 **호출하지 않음**(enrich 없음) + raw 필드(symbol/companyName/marketCap) 반환, per/psr 미설정.
- 페이지(`fundamentalData.getStockPeers`)가 raw 경로를 사용.
- **회귀 가드**: 분석 경로(core 포트 `getStockPeers`)는 여전히 enriched(per/psr 채워짐) — FactLayer N/A 회귀 방지.
- `FakeFundamentalDataProvider.getStockPeersRaw` 존재(E2E 빌드 통과).

### 변경 3
- 같은 거래일 1Day getBars 2회 호출 시 **과거 윈도우(`before:histTo`)** inner 호출은 1회(long-cache hit), **최근 윈도우(`from:recentFrom`)** 는 짧은 TTL.
- `mergeBarsByTime`(순수): 겹치는 time은 recent 우선, 오름차순 dedup. 분리 전후 결합 시리즈가 단일 `getBars(from=now−730d)`와 **동일 집합**.
- 1Day가 아니거나 `before` 지정 시 기존 `bars:raw` 단일 경로 사용(분리 미적용).
- `now` 의존 윈도우(`histTo`/`recentFrom`)는 `vi.setSystemTime`로 결정화(기존 flaky 사례 회피).

---

## 6. 예상 효과 (실측 기반)

| 영역 | 현재 | 개선 후(예상) |
|---|---|---|
| valuation(383, 호출 49%) | 페이지+분석 fan-out, 1h TTL | 페이지 fan-out 0 + 분석 24h 캐시 → 대폭↓ |
| EOD(6.59MB, egress 62%) | 장중 60s마다 730일 재fetch | 거래일당 1회/심볼 → egress·호출 급감 |
| quote(live tail) | 117 | ~유지(의도된 live) |

---

## 7. 영향 파일 (예상)

- `shared/api/fmp/fundamentalClient.ts` — TTL 상수.
- `shared/api/fmp/fundamentalProvider.types.ts` — `FundamentalProviderWithRawPeers` 인터페이스 추가.
- `shared/api/fmp/CachedFundamentalProvider.ts` — `getStockPeersRaw` 구현 + implements 변경.
- `shared/api/fmp/getFundamentalDataProvider.ts` — 반환 타입 `FundamentalProviderWithRawPeers`.
- `shared/api/fmp/FakeFundamentalDataProvider.ts` — `getStockPeersRaw` 구현(E2E).
- `app/[symbol]/fundamental/fundamentalData.ts` — 페이지 peer를 raw로 위임.
- `shared/api/market/CachedMarketDataProvider.ts` — 1Day 2-윈도우 분리 캐싱 + `mergeBarsByTime`(순수 함수, 동일 파일 또는 sibling). **`FmpMarketProvider`·core 무변경.**
- 각 colocated `__tests__`.
