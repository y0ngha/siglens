---
name: 다중 시간대 분석
description: 상위 시간대에서 추세 방향을 확인하고 하위 시간대에서 최적의 진입 타이밍을 잡는 체계적 분석 프레임워크
type: strategy
category: neutral
indicators: ['ma', 'rsi', 'macd']
confidence_weight: 0.8
gating:
  tier: always_on
token_cost: 335
digest_hash: "346cafa9"
---

## Overview

Each analysis request carries a **single timeframe**. This skill is therefore a **higher-timeframe trend filter**, not a three-chart workflow: estimate the dominant (higher-timeframe) trend from the long moving averages and the price structure in the provided bars, then judge whether the signals from other skills agree with it. It adds a directional filter; it does not predict direction by itself.

## Estimating the Higher-Timeframe Trend

Read the long MAs from the `- MA:` indicator line — MA(60), MA(120), MA(200) — and the swing structure in the bars:

- **Uptrend**: price above MA(120) and MA(200); MA(60) above MA(200) and rising; higher highs and higher lows.
- **Downtrend**: price below MA(120) and MA(200); MA(60) below MA(200) and falling; lower highs and lower lows.
- **Range / transition**: price between the long MAs, long MAs flat or crossing, no clear swing sequence.
- The Long-term horizon levels in `## Market Reference` mark where the dominant trend may meet support or resistance.

## Filter Rules

1. Signals in the direction of the estimated dominant trend carry more weight; counter-trend signals need more confirmation and must be flagged as counter-trend.
2. Long-horizon support/resistance outweighs a short-term signal pointing into it.
3. In a range or transition, both directions are possible — lower conviction either way.

## Alignment (available data only)

Compare three layers inside the provided timeframe: the long-MA trend (MA60/120/200), the short/medium structure (MA5/MA20, recent swings), and momentum (RSI vs 50, MACD vs its zero line). All three agree = strong; two agree = partial; long trend contradicted by the others = conflicting.

## Confidence Weight Rationale

confidence_weight: 0.8 — trading with the dominant trend is a near-universal practitioner discipline, and here it works as a filter on other skills rather than as a signal. Confidence falls when the long MAs are flat or tangled, when too few bars exist for MA(200), or when the trend is late-stage (extended momentum, climactic volume).

## Caveats

- Long MAs on one timeframe are a proxy for a higher-timeframe chart, not a substitute. If MA(200) is unavailable, say the estimate is weak.
- Lower-timeframe entry timing cannot be judged from this input; if it matters, recommend the user check a lower timeframe.
- Alignment does not predict: aligned setups still fail on unexpected catalysts.

## AI Analysis Instructions

Return the summary in **this exact structured format** (one `**label**: value` pair per line):

```
**상위 시간대 추세**: [장기 이평·가격 구조로 추정한 지배 추세, 예: "상승 추세 — 가격이 MA(120)/MA(200) 상방, MA(60) 상승, Higher High/Higher Low"]
**시간대 정렬도**: [가용 데이터 기준 정렬, 예: "강함 — 장기 이평·단기 구조·모멘텀 모두 상승" / "부분 — 장기 상승, 단기 조정 중" / "충돌"]
**방향성 판단**: [종합 방향, 예: "상승 우위 — 매수 방향 신호에 가중, 역추세 매도 신호는 추가 확인 필요"]
**상세 분석**: [추세 추정 근거, 정렬 상태, 장기 지지·저항, 역추세 경고, 하위 시간대 확인 권고(필요 시)를 포함한 상세 분석 문단]
```

Additional output rules:
- If another skill's signal runs against the estimated dominant trend, explicitly label it counter-trend.
- If the dominant trend shows late-stage exhaustion, warn even when direction aligns.
- Set the `trend` field: `bullish` if the dominant trend is up and at least two layers agree, `bearish` if down and at least two layers agree, `neutral` if range-bound or conflicting.

<!-- PROMPT_DIGEST:START -->
다중 시간대 분석 (confidence_weight 0.8)
Input is a single timeframe. Use this skill as a higher-timeframe trend FILTER: estimate the dominant trend from the long MAs on the `- MA:` line (MA60/MA120/MA200) and the swing structure, then weigh other skills' signals against it.
Uptrend: price above MA120/MA200, MA60 above MA200 and rising, HH/HL. Downtrend: mirror. Range: price between long MAs, MAs flat/crossing, no clear swings.
Rules: signals with the dominant trend weigh more; counter-trend signals need more confirmation — label them counter-trend. Long-horizon S/R outweighs a short-term signal into it. Range → lower conviction both ways. Late-stage exhaustion → warn even if aligned. MA200 unavailable → say the estimate is weak. Lower-TF entry timing can't be judged here — recommend checking a lower timeframe if needed.
Alignment layers: long-MA trend; short/medium structure (MA5/MA20, recent swings); momentum (RSI vs 50, MACD vs zero). 3 agree = 강함, 2 = 부분, long trend contradicted = 충돌.
Output (one **label**: value per line):
**상위 시간대 추세**: [예: 상승 — MA120/MA200 상방, MA60 상승, HH/HL]
**시간대 정렬도**: [강함 / 부분 / 충돌 — 가용 데이터 기준]
**방향성 판단**: [예: 상승 우위 — 역추세 매도 신호는 추가 확인 필요]
**상세 분석**: [추세 근거, 정렬, 장기 S/R, 역추세 경고, 하위 시간대 확인 권고(필요 시)]
trend: bullish if dominant trend up and ≥2 layers agree, bearish if down and ≥2 agree, else neutral.
<!-- PROMPT_DIGEST:END -->
