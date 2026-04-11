---
name: 스퀴즈 모멘텀 신호 가이드
description: Squeeze Momentum Indicator(BB:20, KC:20, mult:1.5) 신호 해석 가이드 — 변동성 압축 감지, 모멘텀 방향, 돌파 시점 식별
type: indicator_guide
indicators: ['squeezeMomentum']
confidence_weight: 0.8
---

## Overview

The Squeeze Momentum Indicator, originally developed by LazyBear (PineScript: https://www.tradingview.com/v/4IneGo8h/), combines Bollinger Bands (BB) and Keltner Channel (KC) to detect periods of volatility compression ("squeeze") and measures the momentum of the subsequent release. The core insight is that when BB contracts inside KC, price is coiling — energy is building for a high-probability breakout. The linear regression momentum value reveals the directional bias of that energy.

**Parameters used:** BB length = 20, KC length = 20, KC multiplier = 1.5 (applied to both BB deviation and KC ATR offset).

**Dependency note:** Squeeze Momentum is not a standalone oscillator — it requires both Bollinger Bands and Keltner Channel data to compute its squeeze state. The momentum component itself is derived from a separate linear regression of price deviations. All three inputs (BB, KC, and the regression series) must be available for the indicator to produce a meaningful reading.

## Signal Interpretation

### Squeeze State

- **Squeeze ON (`sqzOn = true`)**: Bollinger Bands are entirely inside the Keltner Channel — volatility has compressed to an extreme. This is the setup phase. The longer the squeeze persists, the more energy is coiled and the more powerful the eventual breakout.
- **Squeeze OFF (`sqzOff = true`)**: Bollinger Bands have expanded back outside the Keltner Channel — the squeeze has been released. This is the trigger phase. Price is beginning to move with expanded volatility.
- **No Squeeze (`noSqz = true`)**: Neither condition is met — a transitional state, less actionable on its own.

### Momentum Value (momentum)

The momentum value is derived from a linear regression of `close − avg(avg(highest_high, lowest_low), sma_close)` over 20 bars. It measures the directional momentum within the squeeze context:

- **momentum > 0 and rising (`increasing = true`)**: Bullish momentum is strengthening — price is trending upward with increasing force.
- **momentum > 0 and falling (`increasing = false`)**: Bullish momentum is weakening — the upward move may be losing steam.
- **momentum < 0 and falling (`increasing = false`)**: Bearish momentum is strengthening — price is trending downward with increasing force.
- **momentum < 0 and rising (`increasing = true`)**: Bearish momentum is weakening — the downward move may be bottoming out.
- **momentum crossing zero (sign change)**: Momentum direction reversal — one of the most significant signals. A cross from negative to positive is a bullish reversal; positive to negative is a bearish reversal.

### Combined Squeeze + Momentum Signals

- **sqzOff + momentum > 0 + rising**: Highest-probability bullish breakout — squeeze just released with strong upward momentum. Classic buy setup.
- **sqzOff + momentum < 0 + falling**: Highest-probability bearish breakdown — squeeze just released with strong downward momentum. Classic short setup.
- **sqzOn + momentum rising (positive)**: Bullish energy accumulating within the squeeze — anticipate upside breakout.
- **sqzOn + momentum falling (negative)**: Bearish energy accumulating within the squeeze — anticipate downside breakdown.
- **sqzOff + momentum direction change**: Squeeze released but momentum is already reversing — potential false breakout or early exhaustion.

## Directional Bias Assessment

When the squeeze fires (`sqzOff` transitions from false to true), evaluate momentum direction at the moment of release:

1. If `momentum > 0` at release: bullish breakout expected — price likely to continue higher.
2. If `momentum < 0` at release: bearish breakdown expected — price likely to continue lower.
3. The `increasing` field provides a real-time momentum acceleration signal — rising absolute value means the move is gaining strength, falling absolute value means it is decelerating.

## Recommended Combinations

- **Squeeze Momentum + MACD**: MACD histogram direction at the moment of squeeze release confirms the breakout direction. Both aligned = very high-probability setup.
- **Squeeze Momentum + RSI**: RSI above 50 with sqzOff + momentum > 0 reinforces bullish breakout. RSI below 50 with sqzOff + momentum < 0 reinforces bearish breakdown.
- **Squeeze Momentum + Volume Analysis**: Buy volume surge during squeeze release (sqzOff) dramatically increases breakout reliability.
- **Squeeze Momentum + Keltner Channel**: The squeeze is defined by BB/KC relationship, so reviewing the Keltner Channel width provides additional context on whether the squeeze is tightening or loosening.
- **Squeeze Momentum + Supertrend**: Supertrend direction alignment with squeeze release momentum provides a strong trend-following entry confirmation.

## Caveats

- The squeeze can persist for many bars — a long squeeze is not a fading signal. In fact, prolonged squeezes (10+ bars) historically produce larger moves upon release.
- In choppy, low-volatility markets, the squeeze may cycle on and off frequently without producing meaningful moves. Confirm with ADX (ADX > 20 indicates sufficient trend strength).
- The momentum value from linear regression is a smooth, lagging measure. It will not capture sharp intraday reversals — it reflects the underlying directional bias over the window period.
- Do not use momentum zero-crossings in isolation on very short timeframes — noise can cause frequent crossings without sustained directional moves. Require the cross to hold for at least 1-2 bars.
- This indicator is best applied on daily and hourly charts. On minute charts, reduce the KC/BB lengths to 10-14 for more responsive signals.
