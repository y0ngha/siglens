# Market Events Context — technical 프롬프트 뉴스 주입 설계

작성일: 2026-09-06
관련: `@y0ngha/siglens-core` (도메인·프롬프트), `siglens` (조회·배선)

## 문제

technical 축은 순수 차트 분석이다. 뉴스는 news 축과 overall 축만 쓴다.

그래서 차트에 나타난 갭·급등락을 모델이 **원인을 모른 채** 해석한다. 실측 예: NVDA
2026-09-02은 하루 +2.15%, 변동폭 4.33%였는데, technical 프롬프트에는 그것이 실적
발표 때문인지 매크로 때문인지 알 근거가 전혀 없다. 모델은 지표 조합만 보고 "왜"를
추측한다.

## 목적 — 설명이지 예측이 아니다

**이미 일어난 봉 움직임의 원인**을 알려 주는 것이 목적이다. 다가올 이벤트(실적 발표
예정 등)를 판단에 반영하는 것은 이 설계의 범위가 아니다.

그 구분이 나머지 결정을 전부 좌우한다:

- 과거 이벤트는 **확정**돼 있어 캐시 키가 안정적이다. 미래 이벤트는 수시로 갱신된다.
- 과거 원인 설명은 차트 해석의 일부다. 미래 전망 종합은 overall 축의 일이다.

## 무엇을 주입하나

`## Market Events` 섹션. **본문 없이 이벤트 사실만** 싣는다.

```
## Market Events (NVDA · within the 40 bars above)
- 12 bars ago (2026-09-04 15:30): earnings, bullish, high impact
- 28 bars ago (2026-09-04 11:30): regulation, bearish, medium impact
```

제목·요약·URL은 넣지 않는다. 모델에게 필요한 것은 "그 시점에 실적 이벤트가 있었고
긍정적이었다"이지 기사 문구가 아니다. 문구를 넣는 순간 overall 축과 역할이 겹친다.

### 시각 표기

`formatBarDateTime`(core `promptFormat.ts`)을 그대로 쓴다. `## Recent Bar Data`,
`## Prior Analyses`와 **같은 헬퍼**여야 세 섹션이 한 시간축으로 정렬되고, 모델이
이벤트를 봉 행에 직접 대응시킬 수 있다.

이 정합은 최근에 `## Prior Analyses`가 날짜만 찍어 깨져 있던 것을 고친 부분이다
(core PR #190, `PROMPT_TEMPLATE_VERSION` p10). 새 섹션이 같은 실수를 반복하지
않도록 처음부터 공유 헬퍼를 쓴다.

## 윈도우 — 별도 설정을 두지 않는다

`PROMPT_CONFIG_BY_TIMEFRAME`의 `recentBarsCount`가 이미 타임프레임별로 정의돼 있다.

| 타임프레임 | recentBarsCount | 실제 기간 |
|---|---|---|
| 5Min | 48 | 약 4시간 |
| 15Min | 40 | 약 10시간 |
| 30Min | 36 | 약 18시간 |
| 1Hour | 32 | 약 32시간 |
| 4Hour | 30 | 약 5거래일 |
| 1Day | 30 | 약 30거래일 |

뉴스 윈도우를 여기에 맞춘다. 즉 **모델이 실제로 보고 있는 봉 구간**에 발행된 뉴스만
들어간다. 타임프레임별 윈도우를 따로 정의할 필요가 없고, "5분봉 분석에 12시간 전
뉴스가 실린다" 같은 부정합도 구조적으로 생기지 않는다.

경계는 봉 시각 기준이다 — 첫 봉의 시각 이상, 마지막 봉의 시각 이하. 벽시계가 아니라
봉이라 야간·주말 갭이 자동으로 제외된다.

## 필터

`priceImpact IN ('high', 'medium')`만 남긴다.

운영 데이터 분포(2026-09-06 기준, 485,392행):

| priceImpact | 건수 | 비중 |
|---|---|---|
| negligible | 295,078 | 60.8% |
| medium | 84,075 | 17.3% |
| low | 65,706 | 13.5% |
| **high** | **6,018** | **1.2%** |
| null(미분석) | 34,515 | 7.1% |

`negligible`과 `low`를 버리면 18.5%가 남고, 봉 범위로 자르면 대부분 **0~2건**이다.
`null`(아직 분석되지 않은 기사)도 제외한다 — 영향도를 모르는 기사를 "영향 있음"으로
싣는 것은 없는 정보를 지어내는 것과 같다.

상한은 `MARKET_EVENT_LIMIT = 5`. 이벤트가 몰린 날(실적 시즌)에 섹션이 비대해지는
것을 막는다. 초과 시 `priceImpact` 내림차순 → 최신순으로 자른다.

## 캐시 키

이벤트 fingerprint를 캐시 키에 접는다. `narrowPriorAnalysesForCacheKey`와 같은
방식으로, 선택된 이벤트의 `publishedAt` 목록을 해시한다.

**이력과 달리 TTL 게이트가 필요 없다.** 과거 봉 구간의 이벤트는 이미 확정돼 있어
같은 봉 범위를 보는 두 요청이 서로 다른 이벤트 집합을 볼 수 없다. 이력에서 필요했던
"방금 만든 분석이 다른 사용자의 캐시를 무효화하는" 문제가 여기서는 발생하지 않는다.

단 한 가지 예외: **뉴스 수집 지연**. 봉이 지나간 뒤에 그 시각의 기사가 뒤늦게
수집되면 fingerprint가 바뀐다. 이는 캐시 미스 한 번으로 끝나고, 새 분석이 더 정확한
정보를 갖게 되므로 허용한다.

이벤트가 없으면 fingerprint는 `undefined`이고 섹션도 렌더되지 않는다 — 프롬프트와
캐시 키가 이 기능 도입 이전과 **바이트 단위로 동일**하다.

## 아키텍처

이력 주입(`priorAnalyses`)과 같은 구조를 따른다. core는 저장소를 모른다.

```
siglens                                  core
───────                                  ────
news 테이블 조회                    →    SubmitAnalysisOptions.marketEvents
(봉 범위 + impact 필터)                  ↓
                                         narrowMarketEventsForCacheKey
                                         ↓ fingerprint → buildAnalysisCacheKey
                                         ↓ events → buildAnalysisPrompt
                                         ↓
                                         formatMarketEventsSection
```

### core

- `MarketEvent` 타입 (`domain/types.ts`)
  - `publishedAt: Date`, `category: NewsCategory`, `sentiment: NewsSentiment`,
    `impact: NewsImpact`
  - 기존 `NewsSentiment` / `NewsCategory` / `NewsImpact`를 **재사용**한다. 새 enum을
    만들지 않는다.
  - 산문 필드 없음 — 로케일 중립이라 4개 출력 언어가 한 데이터를 공유한다
    (`PriorAnalysis`와 같은 원칙).
- `domain/analysis/marketEventsSection.ts`
  - `selectMarketEvents(events, bars, limit)` — 봉 범위로 자르고 상한 적용
  - `formatMarketEventsSection(selected, bars, symbol, timeframe)` — 렌더
- `infrastructure/cache/config.ts`
  - `narrowMarketEventsForCacheKey(events, bars)` → `{ candidates, fingerprint }`
  - `buildAnalysisCacheKey`에 `eventsFingerprint` 인자 추가 (마지막 위치, optional)
- `SubmitAnalysisOptions.marketEvents?: readonly MarketEvent[]`
- `PROMPT_TEMPLATE_VERSION` bump

### siglens

- `entities/news-article`에 조회 함수 추가
  - `findMarketEventsForPrompt({ symbol, from, to })` → `MarketEvent[]`
  - `import 'server-only'`, barrel 제외 (기존 `DrizzleNewsRepository` 선례)
  - 인덱스는 이미 있다 — `news_symbol_published_at_idx`. 마이그레이션 불필요.
- 호출부 4곳에 배선 (이력 조회와 같은 지점)
  - `app/api/analysis/stream/route.ts` — technical
  - `entities/analysis/api.ts` — prewarm technical
  - overall 경로 2곳은 **제외**. overall은 이미 뉴스 본문을 받는다.

## 왜 overall과 겹치지 않나

| 축 | 뉴스 사용 방식 |
|---|---|
| news | 기사 본문을 읽고 개별 기사를 분석 |
| overall | 뉴스 분석 결과를 다른 축과 **종합**해 전망 |
| **technical** | 이벤트 **발생 사실**만 알고 차트 움직임을 해석 |

technical은 기사를 읽지 않는다. "이 봉 구간에 high-impact 실적 이벤트가 있었다"는
사실만 안다. 그것으로 충분히 "왜 여기서 갭이 났는지"를 설명할 수 있고, 본문 해석은
여전히 news/overall의 몫이다.

## 검증

### 단위

- 봉 범위 밖 이벤트가 제외되는가
- `negligible`/`low`/`null`이 걸러지는가
- 상한 초과 시 impact 우선 정렬로 잘리는가
- 이벤트 0건이면 섹션이 `''`이고 fingerprint가 `undefined`인가
- 시각 표기가 `formatBarDateTime`과 일치하는가 (봉 행과 문자열 동일)

각 테스트는 구현을 되돌려 의도한 것만 깨지는지 확인한다.

### A/B (실제 LLM)

이미 구축된 봉 재생 백테스트를 재사용한다. `publishedAt <= 봉 시각`으로 과거 시점을
재현할 수 있어, 뉴스 ON/OFF를 같은 봉으로 비교할 수 있다.

측정 대상:

- **이벤트일 판단 정확도** — NVDA 2026-09-02(+2.15%, 변동폭 4.33%) 같은 급등일에
  뉴스를 준 쪽이 원인을 짚는가
- **산문 인용률** — 모델이 이벤트를 실제로 언급하는가 (이력 주입에서 65스텝 중 2건
  관측된 것과 같은 방식으로 센다)
- **앵커링 부작용** — `trend`/`stopLoss`가 뉴스 감정에 끌려가지 않는가. 이력 A/B에서
  `stopLoss`가 65개 중 54개 동일했던 것이 기준선이다.

## 범위 밖

- **미래 이벤트**(실적 발표 예정, 규제 심사 일정) — 캐시 전략이 달라 별도 설계가
  필요하다.
- **뉴스 본문·제목 주입** — overall과 역할이 겹친다.
- **overall 축 배선** — 이미 뉴스를 받는다.
- **뉴스 수집·분석 파이프라인 변경** — 기존 `news` 테이블을 읽기만 한다.

## 미해결

`news.priceImpact`는 AI가 매긴 값이라 정확도가 검증된 적 없다. 이 설계는 그 값을
필터 기준으로 신뢰한다. A/B에서 뉴스 ON이 개선을 보이지 않으면, 기능 자체보다
`priceImpact` 품질을 먼저 의심해야 한다.
