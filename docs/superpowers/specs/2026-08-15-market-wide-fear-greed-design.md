# 시장 전체 공포·탐욕 지수 — 설계

- 날짜: 2026-08-15
- 레포: `siglens` (UI/데이터) + `@y0ngha/siglens-core` (지표 계산)
- 참고: CNN Business "Fear & Greed Index" (https://edition.cnn.com/markets/fear-and-greed)

---

## 1. 배경과 목표

SigLens에는 이미 **종목별** 공포·탐욕 지수(`/{symbol}/fear-greed`)가 있다.
없는 것은 **시장 전체** 심리 지표다. 개별 종목 점수만으로는 "지금 시장이
전반적으로 과열인가 공포인가"를 답할 수 없다.

CNN Fear & Greed와 같은 성격의 시장 단위 지표를 `/fear-greed` 상위 라우트에
추가한다. 종목 지수와 마찬가지로 **AI 분석은 쓰지 않는다** — 순수 계산이므로
결정론적이고, 캐시 가능하고, 비용이 0이다.

### 목표

1. 시장 단위 0~100 점수 + 5단계 라벨(극심한 공포 ~ 극심한 탐욕)
2. 팩터별 기여도 분해 — 왜 이 점수인지 보여준다
3. 과거 비교(현재 / 1주 전 / 1개월 전 / 1년 전) — CNN 페이지와 같은 구성
4. `/market`, `/news`와 동급의 상위 라우트 + SEO(메타데이터·JSON-LD·사이트맵·헤더 내비)

### `/fear-greed` URL 소유권 — 2026-07-26 허브 스펙과의 충돌

`docs/superpowers/specs/2026-07-26-seo-title-and-fear-greed-hub-design.md` §4는 같은
`/fear-greed` URL을 **265종목 공포지수 랭킹 허브**(극공포/극탐욕 Top 20 + 전체 목록,
`fear_greed_snapshots` 테이블, `ItemList`/`Dataset` JSON-LD)로 예약해 두었다. 그 안은
**구현된 적이 없다** — 테이블도 코드도 존재하지 않는다.

이 URL은 **시장 전체 지수**가 갖는다. 근거: CNN의 동명 페이지가 정확히 이 성격이고,
"공포 탐욕 지수" 헤드 쿼리의 검색 의도도 종목 랭킹이 아니라 시장 심리다.

허브 스펙이 풀려던 문제(종목 265개 중 161개가 내부 링크 0)는 **이 작업에서 해결되지
않는다.** 남는 조치는 두 가지이며 별도 작업으로 남긴다:
1. 랭킹 허브가 필요하면 `/fear-greed/ranking` 같은 하위 경로로 옮긴다.
2. 고아 링크 문제는 sitemap이 아닌 별도 내부 링크 전략으로 다룬다.

이 작업이 대신 넣은 것: 종목별 `/{SYMBOL}/fear-greed` 본문에서 시장 전체 지수로 가는
앵커. 265개 종목 페이지 → 허브 방향의 토픽 링크를 확보해 카니벌라이제이션을
허브 쪽으로 정렬한다.

### 비목표

- AI 해설 생성 (종목 지수와 동일하게 없음)
- 실시간(인트라데이) 갱신 — 일간 종가 기반이므로 하루 1회 변한다
- CNN 값의 정확한 재현 — 아래 §3 참고

---

## 2. 어디에 무엇을 두는가 (SCOPE 결정)

`docs/architecture/SCOPE.md` §3 결정 트리를 그대로 따른다.

| 조각 | 위치 | 근거 |
|---|---|---|
| 팩터 계산·백분위 정규화·합성 | **siglens-core** | Step 4 — 지표 계산식은 core |
| FMP 일간 종가 fetch | **siglens** | Step 3 — 외부 시장 데이터 API 호출은 consumer |
| 의미론적 키 → 티커 매핑 | **siglens** | 데이터 소스 지식은 consumer 소유 |
| Redis / ISR 캐싱 | **siglens** | 분석 캐시가 아닌 일반 데이터 캐시 |
| 페이지·위젯·게이지·라벨 | **siglens** | Step 1 |

core의 입력 계약은 **티커가 아니라 의미론적 키**다:

```ts
type MarketFearGreedSeriesKey =
    | 'sp500' | 'vix' | 'longTreasury'
    | 'highYield' | 'investmentGrade' | 'equalWeight';

type MarketFearGreedInput = Record<MarketFearGreedSeriesKey, MarketDailyClose[]>;
```

core는 `SPY`가 무엇인지 몰라도 된다. siglens가 매핑을 소유한다.

---

## 3. 지표 구성

### 3.1 CNN의 7개 입력 중 무엇을 쓸 수 있는가

FMP `/stable/*` 전 엔드포인트를 조사한 결과(`refs/fmp.txt`), 다음 두 가지는
**어떤 엔드포인트로도 얻을 수 없다**:

| CNN 입력 | FMP 가용성 | 처리 |
|---|---|---|
| Put/Call Ratio | ❌ 없음 | 제외 |
| Stock Price Strength (NYSE 52주 신고가/신저가 개수) | ❌ 개수 집계 없음 | 제외 |
| Stock Price Breadth (McClellan Volume Summation) | ❌ 없음 | 동일가중/시총가중 스프레드로 대체 |

나머지 4개는 일간 종가만으로 그대로 계산 가능하다. 여기에 breadth 대체분을
더해 **5팩터**로 구성한다. 없는 데이터를 추정하거나 지어내지 않는다.

### 3.2 5개 팩터

모두 **값이 클수록 탐욕**이 되도록 부호를 맞춘다.

| 팩터 | 정의 | 데이터 | CNN 대응 |
|---|---|---|---|
| `momentum` | (종가 − MA125) / MA125 | SPY | Market Momentum (동일) |
| `volatility` | −(VIX − MA50) / MA50 | ^VIX | Market Volatility (동일, 부호 반전) |
| `safe_haven` | 주식 20일 수익률 − 장기국채 20일 수익률 | SPY, TLT | Safe Haven Demand (동일) |
| `junk_bond` | 하이일드 20일 수익률 − 투자등급 20일 수익률 | HYG, LQD | Junk Bond Demand (스프레드 대신 총수익 프록시) |
| `breadth` | 동일가중 20일 수익률 − 시총가중 20일 수익률 | RSP, SPY | Stock Price Breadth 대체 |

`breadth` 근거: 동일가중 S&P(RSP)가 시총가중(SPY)을 앞서면 상승이 소수
대형주가 아니라 넓게 퍼져 있다는 뜻이다. McClellan을 못 쓸 때 표준적으로
쓰는 폭(breadth) 프록시다.

### 3.3 티커 매핑 (siglens 소유)

| 키 | 티커 | 비고 |
|---|---|---|
| `sp500` | `SPY` | 지수(^GSPC) 대신 ETF — 수익률 차 팩터에서 TLT/HYG/RSP와 같은 기준(가격 수익률)으로 맞추기 위함 |
| `vix` | `^VIX` | |
| `longTreasury` | `TLT` | 20년+ 미국채 |
| `highYield` | `HYG` | 하이일드 회사채 |
| `investmentGrade` | `LQD` | 투자등급 회사채 |
| `equalWeight` | `RSP` | 동일가중 S&P 500 |

FMP `/stable/historical-price-eod/light`로 6종 전부 실호출 확인 완료
(2026-08-15, 3년 요청 시 763~777 세션).

### 3.4 정규화와 합성

종목 지수와 **완전히 같은 방식**을 쓴다 — 두 지수의 게이지·라벨이 UI에서
어긋나면 안 되기 때문이다.

1. 6개 시리즈를 **날짜 기준 inner join**. 한쪽에만 있는 휴장일은 전부에서
   제외 — 그러지 않으면 수익률 차 팩터의 인덱스가 어긋나 조용히 틀린다.
2. 각 팩터를 **walk-forward 백분위**로 self-normalize. 당일은 자기 분포에
   포함하지 않는다(look-ahead 금지).
3. 5개 백분위의 **동일가중 평균** = 최종 점수.
4. 라벨은 core의 기존 `scoreToLabel` / `FEAR_GREED_LABEL_CUTOFFS`
   (25 / 45 / 55 / 75) 재사용.
5. 신뢰도도 기존 `FEAR_GREED_CONFIDENCE_THRESHOLDS` 재사용
   (표본 ≥ 60 `normal`, ≥ 10 `limited`, 미만이면 `null` 반환).

**웜업**: MA125가 최장 창이므로 125세션 + 백분위 표본 10세션 = 최소 135
공통 세션이 있어야 점수가 나온다. `normal` 신뢰도는 185세션부터.
1Day 조회는 3년(약 750세션)을 가져오므로 여유가 충분하다.

### 3.5 CNN 값과 일치하지 않는다 — 의도적이다

팩터 구성이 다르고(5 vs 7), 정규화 방식도 다르다(CNN은 표준편차 기반
z-score를 쓴다고 알려져 있다). **방향은 일치하되 수치는 다르다.** 페이지에
"CNN 지수와 구성이 다르다"는 문구를 명시한다.

2026-08-14 종가 기준 실측: 점수 80.2 / EXTREME_GREED
(momentum 80.1, volatility 85.7, safe_haven 88.2, junk_bond 87.6, breadth 59.2).
VIX 14.25(역사적 저변동), SPY가 MA125 대비 +8.0% — 탐욕 판정과 정합적이다.

---

## 4. siglens 측 구조

### 4.1 데이터 레이어 — `src/entities/market-fear-greed/`

```
lib/marketFearGreedSymbols.ts   의미론적 키 → FMP 티커 매핑 + LOOKBACK_DAYS
lib/fetchDailyCloses.ts         fmpGet('historical-price-eod/light') 어댑터 (+ from/to 경계)
lib/e2eFearGreedFixture.ts      E2E 결정적 종가 fixture (CI엔 FMP 키가 없다)
lib/buildMarketFearGreedComparisons.ts  히스토리 → 4지점 축약
api/marketFearGreedCache.ts     Redis getOrSetCache (fingerprint 키)
api/marketFearGreedStaticCache.ts  unstable_cache(1h, tag)
model.ts                        페이지가 쓰는 view 타입
index.ts                        barrel
```

**`to` 경계는 반드시 "마지막으로 마감·발행된 세션"이어야 한다.** FMP의 EOD 엔드포인트는
**진행 중인 세션의 행을 실시간가로 반환한다**(24시간 거래 심볼로 실증: 장중에 오늘 날짜
행이 존재). 경계 없이 가져오면 정규장 내내 실시간 틱을 종가로 먹어 점수가 하루 종일
흔들리면서 화면에는 "종가 기준"이라고 적히고, 최종적으로 굳는 값은 마지막 ISR 재생성이
우연히 잡은 틱이 된다. 그래서 bars 캐시가 쓰는 것과 같은 `lastClosedSessionDateEt`
(4시간 발행 버퍼 + DST 처리)를 재사용한다.

기존 `getBarsStatic`을 6번 부르지 않는 이유: 그 경로는 `calculateIndicators`
전체를 돌려 심볼당 ~500KB 페이로드를 만든다. 여기 필요한 건 종가 하나뿐이라
`historical-price-eod/light` 직행이 훨씬 싸다.

캐싱은 `market-summary`와 같은 2단 패턴 —
Redis(`market:fear-greed:<fingerprint>`) → `unstable_cache`(태그 `market:fear-greed`) —
이되 **TTL 정책만 다르다**. 두 단 모두 **1시간 고정**이며 `computeBarsEffectiveTtl`은
쓰지 않는다: 그 정책은 장외 시간에 "다음 개장까지"(최대 24h)로 캡되는데, 이 지수가
먹는 EOD 종가는 **장마감 뒤에** 도착한다. 즉 16:05 ET에 캐시된 항목이야말로 살아남으면
안 되는 항목인데 그 정책은 정확히 그것을 하루 동안 붙잡는다.

### 4.2 페이지 — `src/app/fear-greed/`

- `page.tsx` — 서버 컴포넌트. `revalidate = 3600`(= `/market`과 동일).
  클라이언트 fetch 없음: 일간 데이터라 서버에서 계산해 내려주면 끝이다.
  종목 페이지의 하이드레이션 스켈레톤 문제(React #418)가 여기선 존재하지 않는다.
- `error.tsx` — `/market/error.tsx` 패턴 그대로.
- 메타데이터: canonical `/fear-greed`, `clampSeoDescription`, OG는 기존 정적
  `/og-image.png`(`/market`과 동일 — 전용 OG 라우트는 만들지 않는다).
- JSON-LD: WebPage + Breadcrumb + FAQPage.

`/[symbol]` 동적 라우트와의 충돌은 없다 — Next.js는 정적 세그먼트를 우선한다.

### 4.3 위젯 — `src/widgets/market-fear-greed/`

- `MarketFearGreedPage.tsx` — 조립. 서버 컴포넌트.
- `MarketFearGreedFactorBar.tsx` — 팩터 5개 막대.
- `MarketFearGreedComparison.tsx` — 기간별 비교 4칸. 게이지 자체는 **기존
  `@/widgets/fear-greed`의 `FearGreedGauge`를 재사용**한다(위젯 간 cross-import는
  CLAUDE.md 허용). 다만 `FearGreedComparisonGauges`는 재사용하지 **않는다** — 그
  컴포넌트는 `FearGreedHistoryPoint[]` 전체를 받아 클라이언트에서 4개를 골라내는데,
  여기서는 ~750포인트 히스토리를 RSC 페이로드에 싣지 않으려고 서버에서 미리 4개로
  줄이기 때문이다(아래 §4.1 `comparisons`). 입력 타입이 달라 재사용이 성립하지 않는다.
- 한국어 라벨은 `src/shared/lib/marketFearGreedLabels.ts` 신설
  (기존 `fearGreedLabels.ts`와 같은 계층, 팩터 키가 다르므로 파일 분리).

### 4.4 등록

- 헤더 내비: `src/widgets/layout/headerNavItems.ts`의 `NAV_ITEMS`에 추가.
- 사이트맵: `src/entities/sitemap-entry/lib/buildStaticEntries.ts`에 정적 엔트리 추가.

---

## 5. 에러 처리

| 상황 | 동작 |
|---|---|
| FMP 6종 중 하나라도 실패 | `fmpGet`이 transient 오류를 최대 3회 재시도(백오프 정책은 `src/shared/api/fmp/fmpRetry.ts`)한 뒤에도 실패하면 throw한다. `buildMarketFearGreedView`의 `Promise.all`에는 per-item catch가 없으므로 **성공한 나머지 5종도 함께 버려지고** 예외가 그대로 위로 전파된다 → 아래 "로더 예외" 행으로 합류 |
| 응답이 `200 []` (FMP가 모르는/상장폐지 심볼에 주는 응답) | throw한다. 조용히 빈 배열을 돌려주면 inner join이 비어 "표본이 부족합니다"로 보이는데, 그건 업스트림 장애가 웜업 안내를 뒤집어쓴 것이고 로그에도 아무것도 안 남는다 |
| 응답이 배열이 아님(200이지만 형식 이상) | 위와 같이 사용 가능한 종가 0건 → throw |
| 스냅샷 `null` | 페이지는 200으로 안내 문구를 렌더한다. `notFound()`를 던지지 않는다 — Suspense 안에서 던진 `notFound()`가 soft 404를 만든 전례가 있다 |
| 데이터 부족(공통 세션 135개 미만) | 스냅샷 `null` — 위와 같은 안내 문구 |
| 표본은 있으나 얇음(공통 세션 185개 미만) | `confidence: 'limited'` 배지 |
| 로더 예외 | `getOrSetCache`는 fetcher가 throw하면 아무것도 쓰지 않는다. 예외는 페이지 로더의 `catch`가 받아 빈 상태로 렌더한다 — 캐시에 0바이트가 얼어붙는 인시던트 재발 방지 |

`getOrSetCache`의 `shouldCache` 가드로 스냅샷이 `null`인 결과는 Redis에 캐시하지 않는다.

**부분 실패를 견디지 않는 이유**: 한 시리즈만 비면 날짜 inner join 결과가 0이 되어
어차피 스냅샷이 `null`이다. per-series catch를 넣어도 결과가 같으므로, 실패를
가리지 않고 그대로 던지는 쪽이 로그에 남아 진단 가능하다.

**남는 리스크**: ISR 재생성이 하필 FMP 장애 구간에 겹치면 빈 상태 렌더가 페이지
캐시에 1시간 고정된다(ISR에서는 렌더 한 번만 캐시 제외하는 방법이 없다). 완화 수단은
`fmpGet`의 3회 재시도(`withRetry`)와 1시간 뒤 자동 회복이며, `/market`도 같은
트레이드오프를 택하고 있다. 별도 stale-fallback 장치는 이 비중의 페이지에 과하다고 보고 넣지 않았다.

다만 **재시도 대상이 아닌 오류**(FMP 402/403 — `isFmpTransientError`가 false)면 매시
재생성이 똑같이 실패해 빈 페이지가 영구화되고, fail-open이라 5xx도 헬스체크 실패도
뜨지 않는다. 그래서 로더 실패 로그(`[FearGreedRoute] getMarketFearGreedStatic failed`)에
CloudWatch 메트릭 필터 + 알람을 붙였다(`infra/aws/07-alarms.sh`). ⚠️ 그 스크립트는 배포
파이프라인이 자동 실행하지 않으므로 **수동 1회 실행이 필요하다**(DEPLOY_RUNBOOK §1).

degraded 상태에서는 `generateMetadata`가 `robots: { index: false, follow: true }`로
전환하고 canonical을 떼어, 얇은 페이지가 색인되지 않게 한다.

---

## 6. 테스트

| 대상 | 내용 |
|---|---|
| core `align` | inner join, 정렬, 비유한/비양수 종가 제거, 중복 날짜, JS 경계 결측 |
| core `factors` | 웜업 경계, 5팩터 수식, VIX 부호 반전, 0 분모 가드 |
| core `composition` | 표본 임계값, 동일가중, 팩터 순서, 백분위 정의 |
| core `walkForward` | look-ahead 없음(뒤에 붙여도 앞이 안 변함), 스냅샷 = 히스토리 마지막, 공통 세션만 |
| siglens 매핑 | 6개 키 전부 티커가 있고 중복 없음 |
| siglens fetch | light 응답 → `MarketDailyClose[]` 변환, 실패 시 빈 배열 |
| siglens 캐시 | fingerprint 키, `null` 스냅샷 미캐시 |
| siglens 페이지 | 메타데이터, JSON-LD, 스냅샷 `null` 시 200 + 안내 |
| siglens 위젯 | 게이지·팩터 막대·과거 비교 렌더, 접근성 |
| 사이트맵/내비 | 새 엔트리 존재 |

core 모듈 커버리지는 100%(stmts/branch/funcs/lines) 달성.

---

## 7. 안 하는 것 (YAGNI)

- 전용 OG 이미지 라우트 — `/market`도 정적 OG를 쓴다
- 히스토리 라인 차트 — 과거 비교 게이지 4개가 CNN 페이지 구성과 동일하고 충분하다
- 클라이언트 리페치 / React Query — 일간 데이터에 불필요
- 팩터별 AI 해설 — 목표에서 명시적으로 제외
- 섹터 11종 ETF를 breadth에 동원 — 요청 11회 대비 RSP/SPY 1쌍이 같은 신호를 준다
