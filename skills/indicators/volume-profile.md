---
name: Volume Profile Signal Guide
description: 볼륨 프로파일 신호 해석 가이드 — POC, VAH/VAL, 가치 영역, 거래량 희박 구간
type: indicator_guide
indicators: ['volumeProfile']
confidence_weight: 0.85
usage_roles: [confirmation, measurement]
token_cost: 394
digest_hash: "1bfae4db"
---

## Overview

Volume Profile distributes cumulative traded volume across price levels within a specified period, creating a horizontal histogram. Unlike time-based indicators, Volume Profile reveals the market's acceptance (or rejection) of price at each level based on actual transaction density. The three key reference points are POC (Point of Control), VAH (Value Area High), and VAL (Value Area Low).

## Signal Interpretation

### POC (Point of Control)

- The POC is the price level with the highest volume within the selected period — the market's center of gravity or equilibrium price.
- Price above POC: the market is trading above its most-agreed-upon fair value — a bullish structural positioning.
- Price below POC: the market is trading below its fair value center — a bearish structural positioning.
- POC acts as a strong magnet: price frequently returns to the POC after extended moves. When price approaches POC from above or below, expect strong support or resistance.
- A decisive close through the POC with high volume signals a potential trend flip — buyers and sellers are reversing their relative positions at the most significant level.

### Value Area (VAH and VAL)

- The Value Area represents the price range containing approximately 70% of total session volume. VAH is the upper boundary; VAL is the lower boundary.
- Price trading within the Value Area: market is in an accepted range — balanced, rotational behavior is likely.
- Price breaking above VAH with expanding volume: a bullish breakout from accepted value — trend continuation is likely; price may seek a new, higher equilibrium.
- Price breaking below VAL with expanding volume: a bearish breakdown — trend continuation lower is likely.
- Price returning into the Value Area after an excursion outside: a value reversion trade — historically, price returns to the prior Value Area approximately 80% of the time on the next bar (the 80% rule in volume profile theory).

### Thin Volume Zones

- Areas with very low volume between high-volume nodes represent zones where price moved through quickly — price tends to move rapidly through these zones in either direction.
- Thin volume zones above current price: upside acceleration paths if price enters the zone.
- Thin volume zones below current price: downside acceleration paths.
- When price approaches a thin volume zone, prepare for faster-than-usual price movement.

### High-Volume Nodes (HVN) and Low-Volume Nodes (LVN)

- High-Volume Nodes (HVN): areas of high-volume concentration act as strong support/resistance. Price tends to consolidate or reverse in HVN zones.
- Low-Volume Nodes (LVN): areas of sparse volume between clusters. Price tends to fall through LVNs quickly in the direction of momentum.

## Key Combinations

- Volume Profile + VWAP: When VWAP is near the POC, the level has dual confirmation — institutional intraday fair value and session-long volume distribution agree. This creates the strongest support/resistance zones.
- Volume Profile + Moving Averages: When POC aligns with MA(20) or MA(60), the technical level has multi-system support.
- Volume Profile + Bollinger Bands: The POC near the Bollinger middle band confirms the volume-weighted equilibrium coincides with the price mean — a powerful pivot zone.

## Caveats

- Volume Profile is only as valid as the period from which it is computed. A profile computed over 30 bars has a different meaning than one from 500 bars.
- The 80% return-to-value-area rule is a probabilistic observation, not a guarantee.
- In low-liquidity or pre-market hours, volume profile distributions can be distorted by thin trading.
- POC and VAH/VAL levels shift as new bars are added to the profile window. Real-time changes in these levels should be factored into ongoing analysis.

<!-- PROMPT_DIGEST:START -->
### Volume Profile — POC, VAH/VAL, Value Area, thin zones

**POC (Point of Control)** = highest-volume price level, market center of gravity / equilibrium.
- Price above POC = bullish structural positioning; below POC = bearish.
- Strong magnet — price frequently returns to POC after extended moves; expect strong support/resistance on approach.
- Decisive close through POC on high volume = potential trend flip.

**Value Area (~70% of session volume; VAH upper, VAL lower):**
- Within VA = accepted range, balanced/rotational.
- Break above VAH with expanding volume = bullish breakout, continuation likely (seek higher equilibrium).
- Break below VAL with expanding volume = bearish breakdown, continuation lower.
- Return into VA after excursion = value reversion; price returns to prior VA ~80% of the time on next bar (the 80% rule).

**Thin volume zones** (low vol between high-volume nodes): price moves rapidly through in either direction. Thin zone above price = upside acceleration path; below = downside. Prepare for faster-than-usual movement.

**HVN/LVN:** High-Volume Nodes = strong S/R, price consolidates/reverses. Low-Volume Nodes = price falls through quickly in direction of momentum.

**Combos:** +VWAP (VWAP near POC = dual confirmation, strongest S/R); +MA(20/60) (POC alignment = multi-system support); +BB (POC near middle band = powerful pivot zone).

**Caveats:** valid only for its computed period (30 vs 500 bars differ); 80% rule is probabilistic, not guaranteed; low-liquidity/pre-market distorts distributions; POC/VAH/VAL shift as bars added.
<!-- PROMPT_DIGEST:END -->
