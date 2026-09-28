---
name: 평균 회귀 전략
description: 장기 상승 추세(종가 > MA200) 안에서 단기 과매도(Williams %R(14) ≤ -90)로 눌린 일봉을 되돌림 후보로 판별하는 전략 — 2000~2026 일봉 백테스트로 검증된 규칙만 사용
type: strategy
category: neutral
indicators: ['williamsR', 'ma', 'connorsRsi', 'rsi', 'dmi', 'bollinger', 'atr']
confidence_weight: 0.8
gating:
  tier: gated
  signal_kind: state
  state:
    feature: williamsR
    predicate: level
token_cost: 843
digest_hash: "7de69606"
---

## Overview

Short-term mean reversion in equities is one of the most replicated effects in the literature — weekly/monthly reversal (Jegadeesh 1990, Lehmann 1990) and the daily "RSI(2) pullback" popularised by Larry Connors. What survives measurement, though, is narrower than the textbook version this skill used to teach:

- The effect is a **short-term washout inside a long-term uptrend**: the stock is above its 200-day average and has just closed near the bottom of its two-week range.
- It is **not** a range-market strategy. Requiring a non-trending market (ADX < 25), stacking a Bollinger lower-band touch and RSI(14) < 30, or waiting for the oscillator to cross back out of the extreme zone all measured *worse* than the plain washout reading.
- The horizon is **days, not weeks**: the measured exit is the first close back above the 5-day average, or about ten trading days.

This skill replaces an earlier version (range-bound Bollinger + RSI(14) + ADX < 25 doctrine) after a backtest showed that version's buy rule underperformed random entries in four of five periods, and that its triggers (`rsi_oversold`, `rsi_overbought`, `bollinger_lower_bounce`) fired on fewer than one in ten of the days the measured setup was present (8.9%).

---

## The Measured Setup (daily bars only)

When `## Deterministic Metrics` carries a `### Short-Term Washout` block (daily charts with 200+ bars), it already states this reading, its inputs and the measured base rate — cite that block and do not classify again. Otherwise all three inputs are printed in the prompt — cite them, never recompute:

| Condition | Where to read it | Setup value |
|---|---|---|
| Long-term trend | `MA(200)` in the indicator list vs the latest close | close **above** MA(200) |
| Short-term washout | `Williams %R(14)` | **≤ -90** (close in the bottom tenth of the 14-bar range) |
| Timeframe | chart timeframe | **1Day** |

- **Near setup**: Williams %R between -80 and -90 above MA(200). Direction is the same, the measured edge is smaller — 5-day returns beat the baseline in every period, but since 2020 the margin has been statistically indistinguishable from it (re-measured on 101 large caps, 2000–2026). Describe it as a weaker version, not as the setup, and keep this skill's `trend` neutral for it.
- **Corroboration, not a requirement**: `Connors RSI` ≤ 10 (its [oversold] label) means the same washout seen through a 3-day RSI and the down-streak length. When it agrees, say so; when it does not, the Williams %R reading still stands.
- **Exit reference**: `MA(5)`. The measured trade closes on the first daily close above MA(5), or after about 10 trading days, whichever comes first. Holding for a close above MA(20) instead raised the average in three of five periods but turned the 2007–09 result negative and deepened the loss tail — MA(5) is the conservative reference, not a ceiling on the move.

---

## Evidence

Backtested on daily bars (entry at the signal day's close, 0.1% cost per side):

- **2000-01 → 2020-11**: point-in-time S&P 500 members (615 symbols after removing corrupted series, Yahoo-sourced Qlib dataset).
- **2024-07 → 2026-09**: 9 large-cap stocks + SPY/QQQ (Yahoo).
- Cross-checked against siglens-trader's independent study (FMP data, 2015 → 2026-09, 42 symbols), which adopted the same idea with RSI(2) < 10 on 2026-09-24.
- **Re-measured 2026-09-26** on 101 current large caps + SPY/QQQ (FMP, 2000-01 → 2026-09, survivorship-biased): the washout, near-setup and below-MA(200) readings held the same direction in all six periods; this is the source of the near-setup "statistically indistinguishable since 2020" note and the 1.3–2.8× below-MA(200) loss-tail range.

Mean return over the next 5 trading days, stocks:

| Period | Setup (close > MA200, %R ≤ -90) | Baseline: any day above MA200 |
|---|---|---|
| 2000 – 2007-06 | +0.76% | +0.27% |
| 2007-07 – 2009-06 (financial crisis) | +0.20% | -0.54% |
| 2009-07 – 2014 | +0.79% | +0.35% |
| 2015 – 2020-11 | +0.43% | +0.11% |
| 2024-07 – 2026-09 | +2.18% | +0.24% |

Trades exited on the MA(5) rule (or 10 days, with a disaster stop at 5 × ATR) won **66–75%** of the time in every period and averaged +0.05% to +1.62% after costs, against -0.26% to +0.18% for the same exit entered on any day above MA(200). RSI(2) < 10 — the trader's formulation — measured the same way and was positive against its baseline in all five periods too.

**The edge is relative, not a guarantee.** In the 2007–09 crisis the setup's 10-day return was still negative in absolute terms (-0.71%); it only lost less than the uptrend baseline (-1.03%).

---

## What the Evidence Does Not Support

Each of these was measured on the same data and **did not** hold up. Do not use them as reasons to call or reject the setup:

- **ADX < 25 as a requirement.** The setup with ADX ≥ 30 did as well or better than with ADX < 25 in three of five periods. ADX describes trend strength, not whether a pullback will revert.
- **Bollinger lower band + RSI(14) < 30 (+ ADX < 25).** This was the previous version of this skill. Its buy rule, with its own exits (middle-band target, 2 × ATR stop, 7 bars), trailed random entries with the same exits in four of five periods.
- **Waiting for Williams %R to cross back above -80.** The cross-up entry above MA(200) was at or below zero per trade in every period (-0.40% to 0.00%); the in-zone close at ≤ -90 was positive in all five. By the time the oscillator exits the zone, most of the rebound is gone.
- **Bullish confirmation (reversal candles, bullish signals, bullish indicator confluence).** siglens-trader tested 36 detector signals and candle patterns on the entry day: none improved results consistently. On setup days the rule-engine confluence reads **bearish** about two thirds of the time (68%), and those days did as well as or better than the other setup days in four of five periods. A bearish tally is the normal state of this setup, not a reason against it. When the confluence **exit rule** is also met (about one setup day in five), the next five days were weaker than on other setup days in four of five periods but still beat the uptrend baseline in all five — a caution worth naming, not a veto.
- **Tight stops.** Tighter stops lowered the average trade in every period (no stop ≥ 5 × ATR > 2 × ATR), matching siglens-trader's finding; the 5 × ATR stop exists only as disaster protection.
- **The overbought side as a sell signal.** Williams %R ≥ -20 above MA(200) was followed by slightly weaker-than-baseline but still positive 5-day returns in four of five periods, so shorting it lost money. At most it tempers upside expectations; it is not a bearish call.

---

## Where It Does Not Apply

- **Below MA(200).** Short-term washouts below the 200-day average also bounced on average, but their 10-day losses worse than -10% were more frequent in almost every period — 8.8% of cases vs 3.3% pooled, 1.3–2.8× by period (16.5% vs 9.0% in 2007–09), and siglens-trader's portfolio test found adding them raised returns and maximum drawdown together. Describe such a reading as a higher-risk rebound candidate, never as this setup.
- **Intraday timeframes.** Nothing here was measured on intraday bars, and MA(200) on a 1-hour chart is a different object. siglens-trader measured 1-hour entries with tight exits at -0.25% to -0.30% per trade after costs. On non-daily charts, report the readings as context only and state that the measured setup is daily.
- **Information-driven drops.** A price rule cannot tell a noisy pullback from a repricing (earnings miss, guidance cut, regulatory shock). The big failures of this setup are those. When the prompt shows a fresh negative catalyst, say that the setup's history does not cover it.

---

## Confidence Weight Rationale

confidence_weight: 0.8 — the only strategy skill whose rule was backtested end to end on the same inputs the prompt shows, across five market periods (2000–2026) and two independent data sources, with the same sign in every period. It is not higher because the edge is small per trade (tenths of a percent over baseline in most periods), it is relative rather than absolute in bear markets, and it is blind to news-driven drops.

---

## AI Analysis Instructions

Read the latest close against `MA(200)`, then `Williams %R(14)`, then `Connors RSI` and `MA(5)` — all from the indicator list already in the prompt; never compute them yourself. Classify the chart as exactly one of: setup met, near setup, not met, or not applicable (non-daily chart, or close at/below MA(200)).

Return the summary in **this exact structured format** (one `**label**: value` pair per line):

```
**추세 필터**: [종가 vs MA(200), 예: "종가 182.40 > MA200 165.10 — 장기 상승 추세 안" / "종가 < MA200 — 측정된 셋업 적용 범위 밖"]
**단기 과매도**: [Williams %R(14) 값과 해석, Connors RSI 보조, 예: "Williams %R -94 — 14봉 저점 부근 마감(측정 기준 -90 이하 충족), Connors RSI 8 동조"]
**셋업 판정**: [충족 / 근접(-80~-90) / 미충족 / 해당 없음(일봉 아님 또는 MA200 아래) 중 하나와 한 줄 근거]
**되돌림 기준**: [MA(5) 값, 예: "종가가 MA5 176.20 위로 마감하면 되돌림 완료로 보는 기준, 또는 약 10거래일"]
**지표 합의와의 관계**: [컨플루언스·신호가 약세여도 이 셋업에서는 정상 상태임을 설명하고, 컨플루언스 청산 규칙까지 충족이면 주의로 덧붙임, 예: "지표 합의는 약세 — 이 셋업이 나오는 날의 전형적 상태이며 셋업을 무효화하지 않음"]
**상세 분석**: [셋업의 측정된 성격(상대 우위, 수일 호흡), 뉴스성 급락 여부, 하방 리스크를 포함한 상세 분석 문단]
```

Additional output rules:
- Never cite ADX < 25, a Bollinger band touch, RSI(14) < 30, or a %R cross back above -80 as a condition of this setup — they were measured and did not hold up.
- A bearish indicator tally does not cancel a met setup; state both facts and explain the relationship. A met confluence exit rule is a caution to mention (historically weaker than other setup days, still above baseline), not a cancellation.
- When the setup is met, describe it as a historically favourable short-term pullback reading, not as a certainty or an instruction; mention that in broad market sell-offs the edge was relative, not absolute.
- On the overbought side (%R ≥ -20), say there is no measured sell edge; do not turn it into a bearish call.
- Set the `trend` field: `bullish` only when the setup is met on a daily chart; `neutral` in every other case (near setup, not met, overbought, below MA(200), non-daily). This skill never sets `bearish`.

<!-- PROMPT_DIGEST:START -->
평균 회귀 전략 (confidence_weight 0.8) — measured, daily only
Setup = short-term washout inside a long-term uptrend. On daily charts with 200+ bars, ## Deterministic Metrics prints a `### Short-Term Washout` block with the reading, its inputs and the measured base rate — cite that block and do not classify again. Without the block, read the setup from the indicator list (never recompute):
1. Timeframe 1Day. 2. Latest close ABOVE MA(200). 3. Williams %R(14) ≤ -90.
Near setup: %R -80 to -90 above MA(200) (same direction, a small and recently indistinct edge — trend stays neutral). Connors RSI ≤10 corroborates but is not required. Exit reference: first daily close above MA(5), or ~10 trading days (the conservative measured reference, not a ceiling).

Evidence (daily bars, 0.1% cost/side; S&P 500 point-in-time members 2000-2020 + large caps/SPY/QQQ 2024-26; matches siglens-trader's independent RSI(2)<10 study): next-5-day mean beat the any-day-above-MA200 baseline in every period — 2000-07 +0.76% vs +0.27%, 2007-09 crisis +0.20% vs -0.54%, 2009-14 +0.79% vs +0.35%, 2015-20 +0.43% vs +0.11%, 2024-26 +2.18% vs +0.24%. MA(5)-exit trades won 66-75% in every period. Edge is RELATIVE: in the 2007-09 crisis the 10-day return was still negative (-0.71%), only less than baseline.

Measured and NOT supported — never use as conditions or as reasons against:
- ADX<25 requirement (ADX≥30 did as well or better in 3 of 5 periods).
- Bollinger lower band + RSI(14)<30 (+ADX<25): trailed random entries in 4 of 5 periods.
- Waiting for %R to cross back above -80: lost the edge (≤0 in all 5 periods).
- Bullish confirmation (candles, bullish signals, bullish confluence): no consistent gain. ~2/3 of setup days show a BEARISH indicator tally and they did as well as or better than the rest (4 of 5 periods) — a bearish tally is this setup's normal state, not a reason against it. A met confluence EXIT rule (~1 in 5 setup days) was weaker than other setup days but still beat the uptrend baseline over 5 days in every period: a caution to name, not a veto.
- Tight stops (2-4×ATR) lowered results in every period; 5×ATR is disaster protection only.
- Overbought (%R ≥ -20) above MA(200): slightly below-baseline but still positive returns (4 of 5 periods), shorting lost — tempers upside at most, never a bearish call.

Not applicable: close at/below MA(200) (bounces on average but >10% 10-day losses more frequent in almost every period, 1.3-2.8× — call it a higher-risk rebound candidate, never this setup); non-daily charts (unmeasured; report readings as context only); news-driven drops (earnings/guidance/regulatory — the setup's big failures; say its history does not cover them).

### Output (one **label**: value per line)
**추세 필터**: [종가 vs MA(200)]
**단기 과매도**: [Williams %R(14) + 해석, Connors RSI 보조]
**셋업 판정**: [충족 / 근접(-80~-90) / 미충족 / 해당 없음(일봉 아님 또는 MA200 아래) + 한 줄 근거]
**되돌림 기준**: [MA(5) 값 — 종가가 MA5 위로 마감 또는 약 10거래일]
**지표 합의와의 관계**: [약세 합의는 이 셋업의 정상 상태이며 셋업을 무효화하지 않음; 컨플루언스 청산 규칙 충족이면 주의로 명시]
**상세 분석**: [측정된 성격(상대 우위, 수일 호흡), 뉴스성 급락 여부, 하방 리스크]
- Met setup = historically favourable short-term pullback reading, not a certainty or instruction; note the edge was relative in broad sell-offs.
- trend: bullish only when the setup is met on 1Day (the washout reading, %R ≤ -90); neutral for the near setup and every other case. Never bearish from this skill.
<!-- PROMPT_DIGEST:END -->
