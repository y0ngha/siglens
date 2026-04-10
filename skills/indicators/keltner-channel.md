---
name: Keltner Channel Signal Guide
description: Keltner Channel(20, 10, 2.0) 신호 해석 가이드 — ATR 기반 변동성 채널, 스퀴즈 전략, 추세 확인
type: indicator_guide
indicators: ['keltnerChannel']
confidence_weight: 0.8
---

## Overview

Keltner Channel, originally developed by Chester Keltner in the 1960s and modernized by Linda Bradford Raschke, consists of three lines: an EMA middle line with ATR-based upper and lower bands. Unlike Bollinger Bands (which use standard deviation), Keltner Channel uses ATR for band width, producing smoother bands that are less reactive to sudden price spikes. The standard parameters are EMA(20) for the middle line and 2 × ATR(10) for band offsets.

## Signal Interpretation

### Channel Breakout (Momentum Signal)

- Price closing above the upper band: strong bullish momentum — price has pushed beyond the normal volatility range. In a trending context, this is a continuation signal. In a ranging context, this may signal a breakout.
- Price closing below the lower band: strong bearish momentum — price has broken below the normal volatility range. Downside continuation is likely in a trending context.
- Consecutive closes outside the band (2+ bars): reinforces the breakout — the move has sustained momentum and is less likely to be a false breakout.

### Channel Return (Mean Reversion)

- Price returning inside the channel after an upper-band excursion: momentum is fading — potential mean reversion toward the middle EMA line.
- Price returning inside the channel after a lower-band excursion: selling pressure is exhausting — potential recovery toward the middle line.
- Mean reversion trades from Keltner extremes are most effective when ADX < 25 (non-trending environment).

### Middle Line (EMA) as Dynamic Support/Resistance

- Price above the middle EMA line: bullish structural positioning — the middle line acts as dynamic support on pullbacks.
- Price below the middle EMA line: bearish structural positioning — the middle line acts as dynamic resistance on rallies.
- Bounces from the middle line during trends confirm trend health and provide pullback entry opportunities.

### Bollinger-Keltner Squeeze

- When Bollinger Bands (20, 2) contract inside the Keltner Channel: a **squeeze** is in effect — volatility has compressed to an extreme degree. This signals an imminent high-volatility breakout.
- Squeeze release (Bollinger Bands expand back outside Keltner): the breakout has begun. Direction is determined by which side the price breaks — above the upper Keltner for bullish, below the lower Keltner for bearish.
- The squeeze is one of the most reliable volatility contraction/expansion setups in technical analysis. Use MACD or momentum direction to confirm the breakout direction.

### Channel Width

- Widening channel: ATR is rising — volatility is expanding. Trend moves are likely to be larger.
- Narrowing channel: ATR is declining — volatility is compressing. A squeeze may be forming.

## Recommended Combinations

- Keltner Channel + Bollinger Bands: The Bollinger-Keltner squeeze is the primary synergy — Bollinger inside Keltner signals extreme compression. This is a core setup for volatility breakout strategies.
- Keltner Channel + RSI: RSI overbought/oversold + price at Keltner channel extremes provides dual-confirmation for mean reversion entries.
- Keltner Channel + MACD: MACD direction during a squeeze release confirms the breakout direction. MACD histogram expanding in the breakout direction = high-probability trade.
- Keltner Channel + ADX: ADX > 25 + price outside Keltner band = trend continuation. ADX < 20 + price at Keltner extreme = mean reversion opportunity.

## Caveats

- Keltner Channel bands are smoother than Bollinger Bands because ATR changes more gradually than standard deviation. This means Keltner is slower to react to sudden volatility spikes — both an advantage (fewer false signals) and a disadvantage (slower adaptation).
- The squeeze setup requires both Bollinger Bands and Keltner Channel to be applied simultaneously. The squeeze is not a Keltner-only signal.
- In strongly trending markets, price can ride outside the Keltner band for extended periods (band walk). Do not take mean reversion trades against a strong trend.
- The standard parameters (EMA 20, ATR 10, multiplier 2.0) work well on daily charts. For shorter timeframes, consider EMA 10 with multiplier 1.5 for more responsive signals.
