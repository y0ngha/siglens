---
name: OBV Signal Guide
description: OBV 신호 해석 가이드 — 거래량 누적, 추세 확인, 다이버전스, 브레이크아웃 선행
type: indicator_guide
indicators: ['obv']
confidence_weight: 0.8
usage_roles: [confirmation, measurement]
gating:
  tier: always_on
token_cost: 517
digest_hash: "2bf75817"
---

## Overview

OBV (On-Balance Volume), developed by Joe Granville in 1963, is a cumulative volume indicator that adds volume on up-close days and subtracts volume on down-close days. The fundamental premise is that **changes in accumulation/distribution pattern often precede price reversals** — institutional flows showing up in volume structure (slope changes, divergences, trendline breaks) frequently appear before the corresponding price reversal. Note that this is a pattern-level observation, not a universal "volume leads price" claim; OBV is useful precisely because it can reveal divergence between cumulative flow and price. OBV has over 60 years of history and is one of the most frequently cited volume indicators in academic research.

## Signal Interpretation

### Trend Confirmation

- OBV rising + price rising: the uptrend is confirmed by increasing volume participation — strong bullish conviction. Buyers are accumulating on up days.
- OBV falling + price falling: the downtrend is confirmed by volume distribution — strong bearish conviction. Sellers dominate on down days.
- OBV trending in the same direction as price provides structural confirmation that the current trend has volume support and is likely to continue.

### Divergence Signals

- Bullish divergence: price makes a lower low while OBV makes a higher low → volume is quietly accumulating despite falling prices — a potential upside reversal. This is one of OBV's most powerful signals, often appearing before major bottoms.
- Bearish divergence: price makes a higher high while OBV makes a lower high → volume is draining despite rising prices — a potential downside reversal. Smart money may be distributing holdings.
- OBV divergence signals are most reliable when they occur near significant support/resistance levels or after extended trends.

### OBV Breakout (Leading Signal)

- OBV breaking to a new high before price does: a leading bullish signal — institutional buying is driving volume to new levels, and price is likely to follow.
- OBV breaking to a new low before price does: a leading bearish signal — distribution is accelerating ahead of a potential price breakdown.
- OBV breakouts through its own trendlines can precede price breakouts by several bars, giving an early-entry advantage.

### OBV Flat

- OBV moving sideways while price oscillates: the market is in accumulation/distribution equilibrium — no directional volume conviction. Wait for OBV to break its range before committing to a directional trade.

## Recommended Combinations

- OBV + RSI: OBV divergence confirmed by RSI divergence at the same point creates a dual-confirmation reversal setup with significantly higher reliability.
- OBV + MACD: When OBV breakout coincides with a MACD golden cross, the momentum shift has both volume and price confirmation.
- OBV + Volume Profile: OBV trend direction + Volume Profile POC level alignment = strong institutional support/resistance zone.
- OBV + Bollinger Bands: OBV breakout during a Bollinger squeeze signals directional commitment during low-volatility compression.

## Caveats

- OBV is a cumulative indicator — its absolute value is meaningless. Only the direction and slope of OBV matter.
- OBV treats all volume equally regardless of the magnitude of the price move. A 0.01% gain with 10M volume adds the same as a 5% gain with 10M volume.
- In low-volume environments or for thinly traded stocks, OBV can produce noisy, unreliable signals.
- Gap days can distort OBV significantly — a large gap up on moderate volume inflates OBV disproportionately.
- OBV works best on daily or higher timeframes. Intraday OBV is heavily influenced by market microstructure noise.

<!-- PROMPT_DIGEST:START -->
### OBV (On-Balance Volume) — cumulative volume indicator

Adds volume on up-close days, subtracts on down-close days. Changes in accumulation/distribution pattern (slope changes, divergences, trendline breaks) often precede price reversals — a pattern-level observation, not a universal "volume leads price" law.

Trend confirmation:
- OBV rising + price rising = uptrend confirmed by volume, strong bullish conviction (accumulation on up days).
- OBV falling + price falling = downtrend confirmed by distribution, strong bearish conviction.
- OBV same direction as price = structural confirmation the trend has volume support, likely to continue.

Divergence:
- Bullish: price lower low while OBV higher low → volume quietly accumulating despite falling price, potential upside reversal; one of OBV's most powerful signals, often before major bottoms.
- Bearish: price higher high while OBV lower high → volume draining despite rising price, potential downside reversal (smart money distributing).
- Most reliable near significant S/R levels or after extended trends.

Breakout (leading): OBV to a new high before price = leading bullish, price likely to follow; OBV to a new low before price = leading bearish (distribution accelerating). OBV trendline breaks can precede price breakouts by several bars (early-entry edge).

OBV flat: sideways while price oscillates = accumulation/distribution equilibrium, no directional conviction — wait for OBV to break its range.

Combinations: + RSI (both diverging at same point = dual-confirmation reversal); + MACD (OBV breakout + MACD golden cross = volume + price confirmation); + Volume Profile (OBV direction + POC alignment = strong S/R zone); + Bollinger (OBV breakout during squeeze = directional commitment).

Caveats: cumulative — absolute value meaningless, only direction/slope matter. Treats all volume equally regardless of price-move magnitude. Noisy, unreliable signals for low-volume/thinly-traded stocks. Gap days distort it disproportionately. Best on daily+; intraday dominated by microstructure noise.
<!-- PROMPT_DIGEST:END -->

