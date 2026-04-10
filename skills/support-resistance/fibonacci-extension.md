---
name: 피보나치 확장
description: 되돌림 후 추세 재개 시 목표가(Take Profit) 설정을 위한 피보나치 확장 레벨 분석 도구
type: support_resistance
category: neutral
indicators: []
confidence_weight: 0.7
---

## Overview

Fibonacci Extension calculates projected price targets beyond the original swing range after a retracement completes. While Fibonacci Retracement identifies where a pullback might end, Fibonacci Extension identifies where the subsequent move might reach — making it the primary tool for systematic take-profit target setting.

The tool uses a three-point method (A-B-C) where Point A is the swing start, Point B is the swing end, and Point C is the retracement completion point. Extension levels are projected from Point C using Fibonacci ratios applied to the A-B distance.

---

## Key Extension Levels

### 100% — Equal Measured Move
- Projects a move equal in size to the original A-B swing from Point C
- The 1:1 measurement — the most conservative target
- High-probability target in trending markets

### 127.2% — First Major Extension
- The first significant Fibonacci extension beyond the original move
- Common target for Wave 3 extensions and pattern projections
- Appropriate for partial profit-taking in strong trends

### 161.8% — Golden Ratio Extension
- The most important extension level — the golden ratio projection
- Primary take-profit target for most trading strategies
- Wave 3 in Elliott Wave theory often reaches 161.8% of Wave 1

### 200% — Double Measured Move
- Projects twice the original swing distance
- Indicates a very strong trend with sustained momentum
- Secondary take-profit target after 161.8% is reached

### 261.8% — Extended Projection
- Rarely reached except in exceptionally strong trends
- Indicates potential trend exhaustion when price reaches this level
- Full position exit consideration — the trend may be overextended

---

## Three-Point Application Method

### Point Identification
1. **Point A** (Swing Start): The beginning of the impulse move
2. **Point B** (Swing End): The end of the impulse move (the swing high in uptrend, swing low in downtrend)
3. **Point C** (Retracement End): Where the pullback/correction completes (confirmed by reversal signals)

### In an Uptrend
- A = Swing Low (trend start)
- B = Swing High (first impulse peak)
- C = Retracement Low (pullback completion)
- Extension levels project upward from C: Target = C + (B − A) × Fibonacci ratio

### In a Downtrend
- A = Swing High (trend start)
- B = Swing Low (first impulse trough)
- C = Retracement High (bounce completion)
- Extension levels project downward from C: Target = C − (A − B) × Fibonacci ratio

---

## Signal Interpretation

### Take-Profit Signals
- Price reaches 127.2% extension → consider partial profit-taking (25%–33% of position)
- Price reaches 161.8% extension → primary profit target, consider exiting 50%+ of position
- Price reaches 200% extension → strong profit-taking signal, trend may be maturing
- Price reaches 261.8% extension → consider full position exit, trend exhaustion likely

### Confluence Enhancement
- Extension level + other resistance/support (pivot points, prior swing levels) → stronger target confidence
- Extension level + volume climax → high probability of reversal at that level
- Multiple extension projections from different swings converging → cluster target zone

### Risk Management Integration
- Use extension levels to calculate risk-reward ratios before entry
- Entry at C, stop-loss below A (uptrend) or above A (downtrend)
- Target at 161.8% extension: if risk is C-to-A distance, reward is C-to-161.8% distance
- Only enter trades where the extension-based target provides at least 1:2 risk-reward

---

## AI Analysis Instructions

When analyzing with Fibonacci Extension:

1. First confirm that a retracement has completed (Point C is established) — extension targets are only valid after a retracement completes.
2. Identify the three reference points (A, B, C) from the provided bar data:
   - In an uptrend: A = recent significant Swing Low, B = subsequent Swing High, C = retracement low
   - In a downtrend: A = recent significant Swing High, B = subsequent Swing Low, C = retracement high
3. Calculate extension levels (100%, 127.2%, 161.8%, 200%, 261.8%) projected from Point C.
4. Include relevant extension levels in the priceTargets response field as bullish or bearish targets with the Fibonacci extension ratio as the basis.
5. Use extension levels to validate or strengthen the risk-reward assessment in actionRecommendation.
6. Note any confluence between extension levels and other technical levels (pivot points, prior swing levels, moving averages).

**Caveats:**
- Extension levels are only valid after Point C (retracement completion) is confirmed — do not apply during an active retracement
- Treat extension levels as target "zones" rather than exact prices
- Extension levels are profit targets, not entry signals — they indicate where to exit, not where to enter
- If the A-B swing is too small or unclear, extension projections lose reliability
