---
name: 52주 신고가 모멘텀
description: 종가가 직전 52주 고가(저가)를 모두 넘어선 신고가·신저가를 모멘텀 지속 신호로 해석하는 전략 — George & Hwang(2004) 52주 고가 근접도 연구와 Minervini 추세 템플릿 기반
type: strategy
category: neutral
indicators: ['ma', 'dmi']
confidence_weight: 0.65
gating:
  tier: gated
  signal_kind: event
  triggers: [new_52w_high, new_52w_low]
token_cost: 476
digest_hash: "15f53ec7"
---

## Overview

A new 52-week high is one of the most-watched momentum events. The intuitive reading ("it has run too far, it must pull back") is the opposite of what the research found: stocks at or near their 52-week high have tended to keep outperforming, and stocks far from it have tended to keep underperforming.

**What the core detects**

- `new_52w_high`: the latest close is above **every high** in the prior 52 weeks (a calendar window `[last − 365 days, last)`).
- `new_52w_low`: the latest close is below **every low** in the same window.
- The detector abstains unless the history reaches back at least 358 days, so a "new high" on a stock with less than a year of data never fires.
- These signals only gate this skill in — the signal name is **not printed** anywhere in the prompt. This guide appears only when the engine detected a new 52-week high or low on the latest bar; tell which side fired by comparing the latest close with the 52-week range shown in Market Reference / the recent bar data.

## Evidence

- **George & Hwang, "The 52-Week High and Momentum Investing", Journal of Finance 59(5), 2004.** Ranking stocks by how close their price is to the 52-week high predicted future returns, and this nearness measure dominated past-return momentum (Jegadeesh–Titman) and industry momentum when tested together. Unlike past-return momentum, the 52-week-high strategy's profits did **not reverse** in the long run. Their explanation is anchoring: investors treat the 52-week high as a reference point and are slow to push price through it, so good news is absorbed with a lag.
- **Minervini trend template (practitioner framing, not a peer-reviewed study).** Mark Minervini screens leaders by requiring price above rising long-term moving averages (MA150 / MA200), the shorter averages stacked above the longer ones, and price near its 52-week high. The app computes MA 5 / 20 / 60 / 120 / 200 — use the ones that exist: MA(60) above MA(120) above MA(200), MA(200) rising. (A close above MA(120)/MA(200) is not a separate check — a close above every high of the past year is always above those averages.) There is no MA(50)/MA(150) in the input; never invent their values.

## Interpretation

- **New 52-week high** = momentum continuation candidate, not an overbought sell signal. It is strongest when the moving averages are stacked upward (trend template met) and the breakout bar has above-average volume.
- **New 52-week low** = continued weakness. The same research puts these stocks in the losing group; do **not** call a bounce or "bottom" from a new low alone. A reversal needs separate evidence (e.g. a detected reversal pattern plus a break of structure).
- Overbought oscillators (RSI > 70, etc.) at a new high are normal in strong trends and do not by themselves argue against it.

## What the Evidence Does Not Support

- A precise hit rate, holding-period return, or price target for a single stock — the studies ranked portfolios, not individual breakouts. Never quote a percentage for this chart.
- Using a new 52-week low as a contrarian buy signal.

## Confidence Weight Rationale

0.65 — peer-reviewed, replicated cross-sectional evidence (portfolio-level, monthly horizons), but a single-stock daily event is a noisier application of it, and the Minervini template is practitioner experience.

## AI Analysis Instructions

<!-- PROMPT_DIGEST:START -->
52주 신고가 모멘텀 (confidence_weight 0.65)
- This guide is injected only when the engine detected a new 52-week high or low on the latest bar (latest close above every high / below every low of the prior 365 days; needs ≥358 days of history). The signal name is not printed elsewhere — determine which side fired by comparing the latest close with the 52-week range in Market Reference / recent bar data.
- Evidence: George & Hwang (Journal of Finance 2004) — nearness to the 52-week high predicted future returns, dominated past-return momentum, and did not reverse in the long run (anchoring: investors under-react near the high). Portfolio-level result: never quote a hit rate, return, or target for this chart.
- Practitioner framing (Minervini trend template, adapted to the app's MAs 5/20/60/120/200 — no MA50/150 exists, never invent them): MA(60) > MA(120) > MA(200); MA(200) rising. (Close above MA(120)/MA(200) is automatic at a new high — not a separate check.) Read MA values from the indicator list; never compute new ones.
- New high = momentum continuation candidate, NOT an overbought sell signal; RSI > 70 at a new high is normal in strong trends. Stronger with the template met and above-average breakout volume (cite the computed volume line).
- New low = continued weakness. Never call a bounce or bottom from it; a reversal needs separate evidence (detected reversal pattern + structure break).
- Never compute prices, targets, stops, or R:R.

### Output (one **label**: value per line)
**52주 신호**: [신고가 / 신저가]
**추세 템플릿**: [이평 배열 60>120>200, MA(200) 방향 — 충족 / 부분 충족 / 미충족]
**거래량 확인**: [계산된 거래량 라인 인용 / 확인 불가]
**해석**: [신고가 = 모멘텀 지속 후보 / 신저가 = 약세 지속 — 반등 판단 아님]
**상세 분석**: [근거(George & Hwang 2004), 과매수 지표와의 관계, 반대 신호·리스크]
- trend: bullish for a new high with the MA stack met and MA(200) rising; neutral for a new high when MA(200) is falling or the stack is not met; bearish for a new low.
<!-- PROMPT_DIGEST:END -->
