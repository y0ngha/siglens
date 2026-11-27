---
name: 다중 시간대 분석
description: 상위 시간대에서 추세 방향을 확인하고 하위 시간대에서 최적의 진입 타이밍을 잡는 체계적 분석 프레임워크
type: strategy
category: neutral
indicators: ['ma', 'rsi', 'macd']
confidence_weight: 0.8
gating:
  tier: always_on
token_cost: 556
digest_hash: "ad8157bd"
digest_text_hash: "3d6a8222"
---

## Overview

Each analysis request carries a **single timeframe**, and the prompt computes the next one up in code: `### Higher Timeframe (computed, ...)` inside `## Deterministic Metrics` (a daily chart reads weekly bars, an intraday chart reads daily bars, a weekly chart reads monthly bars). This skill is a **higher-timeframe trend filter**, not a three-chart workflow: quote that block for the dominant trend and the alignment, then say whether the signals from other skills run with it or against it. It adds context for the prose; it does not predict direction by itself and it does not change the top-level trend, the plan or the entry zone.

## Reading the Higher-Timeframe Trend

Take the dominant trend and the alignment from `### Higher Timeframe (computed ...)`. Do not re-estimate them from the long moving averages:

- `<Kind> trend: bullish | bearish | neutral` is the higher-timeframe trend, decided by code (EMA20 move in ATR(14)).
- `Alignment with this chart's trend (...)`: `aligned` (both bullish or both bearish), `opposed` (one bullish, the other bearish), `mixed` (at least one of the two is neutral, which is not the same as disagreeing).
- When the last higher-timeframe bar is flagged as still forming, say the reading can still change.
- When the block reads `Not measurable`, that is an absence of measurement, not a trend. Only then estimate from the `- MA:` line (MA60, MA120, MA200) and the swing structure, and say the estimate is weak.
- When the prompt has no such block at all, estimate the same way from the long MAs and swings and say it is an estimate.
- The Long-term horizon levels in `## Market Reference` mark where the dominant trend may meet support or resistance.

## Filter Rules

1. Say whether each other skill's signal runs with the higher-timeframe trend or against it, and label counter-trend signals as counter-trend.
2. Long-horizon support/resistance outweighs a short-term signal pointing into it.
3. When the higher-timeframe trend is neutral or not measurable, both directions are possible: state lower conviction either way.

## Alignment

Map the block's `alignment` to the card wording: `aligned` = 강함, `mixed` = 부분, `opposed` = 충돌. If the block prints no alignment line, compare the long-MA trend (MA60/120/200), the short/medium structure (MA5/MA20, recent swings) and momentum (RSI vs 50, MACD vs its zero line): all three agree = 강함, two agree = 부분, long trend contradicted by the others = 충돌.

## Confidence Weight Rationale

confidence_weight: 0.8 — checking the larger trend before reading a chart is a near-universal practitioner discipline, and here it works as context for other skills rather than as a signal. Confidence falls when the block reads `Not measurable`, when the long MAs are flat or tangled, or when the trend is late-stage (extended momentum, climactic volume).

## Caveats

- When the higher-timeframe trend is computed, the block's last sentence states the scope of any measurement: only for the daily-versus-weekly pairing on equity charts, a pooled SIGLENS sample of U.S. and Korean stocks and ETFs showed no measured edge on agreeing days in the next 10 sessions' return; every other pairing (intraday versus daily, weekly versus monthly) and crypto says the agreement was not measured. When the trend reads `Not measurable`, neither sentence is printed. Treat alignment as context, never as a reason to act, and never claim a wider scope than the block states.
- If the block reads `Not measurable` and MA(200) is unavailable too, say the estimate is weak.
- Lower-timeframe timing cannot be judged from this input. Leave it out of the summary rather than adding a stock sentence about it.
- A forming last bar (the current session, week or month) can still change the reading.

## AI Analysis Instructions

Return the summary in **this exact structured format** (one `**label**: value` pair per line):

```
**상위 시간대 추세**: [블록의 상위 시간대 추세와 근거, 예: "주봉 상승 — EMA20이 ATR 1.62배 상승, 종가가 EMA20 상방"]
**시간대 정렬도**: [블록의 alignment 기준, 예: "강함 — 주봉·이 차트 모두 상승" / "부분 — 한쪽이 보합" / "충돌"]
**방향성 판단**: [종합 방향, 예: "상승 우위 — 역추세 신호는 역추세임을 명시"]
**상세 분석**: [상위 시간대 추세, 정렬, 장기 지지·저항, 역추세 경고를 포함한 상세 분석 문단]
```

Additional output rules:
- If another skill's signal runs against the higher-timeframe trend, explicitly label it counter-trend.
- If the dominant trend shows late-stage exhaustion, warn even when direction aligns.
- Set this card's own `trend` field to the block's higher-timeframe trend (`bullish`, `bearish` or `neutral`); use `neutral` when the block is not measurable and the estimate is weak or conflicting. This does not change the top-level trend.

<!-- PROMPT_DIGEST:START -->
다중 시간대 분석 (confidence_weight 0.8)
Input is one chart timeframe, and the prompt computes the next one up in `### Higher Timeframe (computed, ...)` (in `## Deterministic Metrics`). Quote that block for the dominant trend and the alignment; do not re-estimate them from the long MAs. Use this skill as a higher-timeframe trend FILTER on other skills' signals.
Block: `<Kind> trend` bullish/bearish/neutral (code-decided); `Alignment with this chart's trend`: aligned (both bullish or both bearish), opposed (bullish vs bearish), mixed (one side neutral, not "disagreeing"). A forming last bar can still change the reading.
Only when the block reads `Not measurable` (absence of measurement, not a trend), or no block is printed, estimate from MA60/MA120/MA200 on the `- MA:` line and the swings, and say the estimate is weak.
Rules: say whether other skills' signals run with or against the higher-timeframe trend; label counter-trend ones. Long-horizon S/R outweighs a short-term signal into it. Neutral or not measurable → lower conviction both ways. Late-stage exhaustion → warn even if aligned. Alignment is context, never a reason to act. When the trend is computed, the block says the agreement showed no measured edge only for daily-vs-weekly on equity charts (pooled U.S./Korean stocks and ETFs, next 10 sessions); every other pairing and crypto is 'not measured'; `Not measurable` prints neither. Never claim a wider scope than the block states; it does not change the top-level trend, the plan or the entry zone. Lower-TF timing can't be judged here — leave it out rather than adding a stock sentence.
Alignment wording: aligned = 강함, mixed = 부분, opposed = 충돌. No alignment line → compare long-MA trend, short/medium structure (MA5/MA20, swings), momentum (RSI vs 50, MACD vs zero): 3 agree = 강함, 2 = 부분, long trend contradicted = 충돌.
Output (one **label**: value per line):
**상위 시간대 추세**: [예: 주봉 상승 — EMA20 ATR 1.62배 상승, 종가가 EMA20 상방]
**시간대 정렬도**: [강함 / 부분 / 충돌 — 블록의 alignment 기준]
**방향성 판단**: [예: 상승 우위 — 역추세 신호는 역추세임을 명시]
**상세 분석**: [상위 시간대 추세, 정렬, 장기 S/R, 역추세 경고]
card trend: the block's higher-timeframe trend; neutral if not measurable and the estimate is weak or conflicting. The top-level trend is unchanged.
<!-- PROMPT_DIGEST:END -->
