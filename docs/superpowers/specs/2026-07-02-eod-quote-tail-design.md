# EOD 캐시 최종 재설계 — quote-tail + 세션-날짜 키

- 작성일: 2026-07-02
- 스코프: `src/shared/api/market/CachedMarketDataProvider.ts`, `src/shared/cache/getOrSetCache.ts`, `FmpMarketProvider`/`FakeMarketProvider`/`getMarketDataProvider`/`getCachedMarketDataProvider`, 신규 `marketProvider.types.ts`
- core 무변경. 선행 설계 `2026-07-01-eod-cache-redesign-design.md`(anchored 2-tier)의 후속 — 실측에서 그 방식이 호출을 못 줄여(cold당 EOD 2회) 재설계.

## 1. 배경 (실측)
`2026-07-01` 설계(anchored 2-tier: history + **recent EOD 윈도우**)를 v0.33.0로 배포했으나, 밤사이 봇 크롤(distinct cold 심볼)에서 `historical-price-eod/full` 호출이 **줄지 않음**:

| 버전 | EOD calls (00:00 UTC, 장외, 배포~10h) | EOD/quote 비율 |
|---|---|---|
| v0.31 baseline | 117 | 1.0× |
| v0.32.0 (split) | 325 | 1.9× |
| v0.33.0 (anchored 2-tier) | 342 | 1.9× |

**근본 원인**: split/anchored 방식이 요청당 EOD를 **2회**(history 윈도우 + recent 윈도우) 호출. 밤 트래픽은 전부 cold distinct 심볼이라 심볼당 2× 고정 → baseline(단일 호출=1×)보다 악화.

## 2. 최종 설계 — 오늘 봉은 quote, 과거는 세션-날짜 키

**핵심**: recent EOD 윈도우 제거. 오늘 봉은 `/quote`(OHLCV 완전)로만, 과거는 EOD 1회.

### Tier 1 — history `bars:eodhist:<SYM>:<lastClosed>`
- **세션-날짜 키**: `lastClosed` = 마지막으로 마감된 세션의 날짜. 미국 마감(16:00 ET)마다 키가 자연 롤 → 세션당 EOD **1회** 재조회. UTC 자정 롤 없음(옛 rolling `from` 문제 제거).
- **세션-aware**:
  - US 주식(`session.kind !== 'always-open'`): `lastClosedSessionDateEt(now)` — 16:00 ET 마감, **DST 반영**(`getEasternOffsetHours`), **발행 버퍼 4h**(마감+4h 후에만 당일로 롤 → FMP 미발행 데이터 캐시 방지), 주말 되감기.
  - 크립토(`session.kind === 'always-open'`, 24/7): `어제(UTC)` — 주말 되감기/ET 마감 없음. **토·일 일봉 보존**(주말 갭 방지).
- fetch: `inner.getBars({ ...options, before: lastClosed })` (FMP `to` inclusive → lastClosed 포함).
- **value-dependent TTL**(FMP 발행 지연 견고성): 가져온 봉의 최신이 lastClosed에 **도달하면 long(7d)**, **미도달이면 short(15m) 재시도** → 발행되면 다음 fetch가 long 승격. (`getOrSetCache.ttlSeconds`를 `number | (value)=>number`로 확장.)
- `isFresh` = covers(from)만(더 과거 요청 시 truncation 방지).

### Tier 2 — today `bars:today:<SYM>`
- `inner.getTodayBar(symbol)` = `/quote`로 만든 오늘 봉(open/dayHigh/dayLow/price/volume → OHLCV 완전). 신규 `SiglensMarketProvider` 인터페이스가 core 포트에 `getTodayBar` 추가; `FmpMarketProvider`가 기존 private `fetchTodayQuoteBar`를 노출.
- 세션 TTL(`computeBarsEffectiveTtl`: 장중 60s, 장외 다음 개장까지).

### 병합
`mergeBarsByTime(history, todayBars)` — 같은 time은 today(live) 우선 → `sliceFrom(options.from)`로 잘라 단일 `getBars(from)`와 동일 집합.

## 3. 갭-free 보장
- history는 항상 `<lastClosed>` 키로 fresh(키가 곧 날짜) → 최신 = lastClosed. today = lastClosed의 다음 세션(또는 동일, dedup). **항상 연속** — "9+11에 10 빠짐" 불가.
- **발행 지연**: 버퍼(1차) + 완전성 검증→short-TTL 재시도(2차). 지연 갭은 **일시적**(≤15m)이며 FMP 발행 시 자가치유. 극단적 >16h FMP 장애 시에만 일시 갭(데이터가 실제로 없는 것).
- **휴장일**: lastClosed가 휴장일 라벨이어도 `before`가 실제 마지막 거래일 반환 → today와 연속(휴장일은 거래 없음). short-TTL 재시도는 그날 bounded.
- **크립토 주말**: `before=어제(UTC)`가 토·일 봉 포함 → 갭 없음.

## 4. 동작별 호출
| 상황 | 재설계 |
|---|---|
| cold 최초 | EOD 1(history) + quote 1(today) |
| 같은 세션 재접속 | 캐시 hit (EOD 0) + quote(60s 캐시) |
| 새 세션(미국 마감) | 키 롤 → EOD 1회 재조회 |
→ **EOD ≈ 1×distinct** (v0.32/v0.33 2× → 반토막), 경계·DST·크립토 정확.

## 5. 에러/계약 보존
FMP throw는 set 전 전파(poison 방지) · 빈 결과 shouldCache 가드 · Redis 미설정/장애 graceful fallback(value-TTL 함수는 set 경로 내에서만 평가) · 기존 numeric TTL 호출부 무영향.

## 6. 사용자 신선도 불변
오늘 봉/가격 = quote(세션 TTL) + 클라 30s refetch. 과거 = 불변. 렌더 회귀 없음(주식 표본 471, 크립토 700 실증).

## 7. 검증
단위 테스트: DST(여름/겨울 20:00 ET 경계) · 버퍼 · 주말 되감기 · 크립토 어제-UTC(주말봉 보존) · 완전→long/미도달→short TTL · merge-under-lag · covers · today=null · guard 분기 · sliceFrom 경계. 변경 로직 파일 branch 커버리지 100%. prod build 실증: AAPL 471봉 / BTCUSD 700봉, 콘솔 에러 0.
