---
name: Indicator Core Reference
description: 계산되는 모든 지표의 1줄 임계 요약 — 상시 주입되는 압축 코어(개별 풀 가이드는 해당 지표가 notable일 때만 게이팅)
type: indicator_guide
indicators: []
confidence_weight: 1.0
gating:
  tier: always_on
token_cost: 644
digest_hash: "b141087e"
---

## Indicator Core (compressed)

Always-on one-line reference for every computed indicator. Interpret only the
values present in this prompt's indicator section; a fuller guide for a given
indicator is injected separately only when that indicator is currently notable.

### Momentum / Oscillators

- **RSI(14):** >70 overbought / <30 oversold; 50 line = momentum bias; band-walk in strong trends, divergence = reversal warning.
- **Stochastic(%K/%D):** >80 overbought / <20 oversold; %K crossing %D = momentum shift.
- **StochRSI:** 0–1 scale; >0.8 overbought / <0.2 oversold (more sensitive than RSI).
- **Williams %R:** >-20 overbought / <-80 oversold (inverted scale).
- **CCI:** >+100 strong up / <-100 strong down; zero-line cross = trend bias change.
- **MFI(14):** volume-weighted RSI; >80 overbought / <20 oversold.

### Trend

- **MA / EMA stack:** ordering (short>mid>long = up, reversed = down); slope and price-vs-MA = trend strength.
- **MACD:** signal-line cross = momentum turn; histogram = momentum acceleration; zero-line = trend bias.
- **ADX:** >25 trending / <20 ranging (strength only, not direction); pair with DMI for direction.
- **DMI(+DI/-DI):** +DI>-DI = bullish, reversed = bearish; cross = directional shift, weight by ADX.
- **Supertrend:** ATR trailing stop; flip = trend reversal, line acts as dynamic support/resistance.
- **Parabolic SAR:** dots flip side = trend reversal / trailing-stop trigger.
- **Ichimoku(9,26,52):** price vs cloud (above bullish / below bearish / inside neutral), TK cross, cloud thickness = support/resistance strength — full guide always available for cloud breakout/breakdown structure.

### Volatility / Bands

- **Bollinger(20,2):** band-walk = trend continuation; squeeze = pending expansion; %B near 1/0 = band extreme.
- **Keltner(20,2·ATR):** ATR envelope; close beyond band = breakout/breakdown; tighter than Bollinger.
- **Donchian(20):** highest-high / lowest-low channel; break = Turtle-style breakout, mid = trend reference.
- **ATR:** absolute volatility (stop/position sizing); rising ATR = expanding range.
- **Squeeze Momentum:** Bollinger-inside-Keltner = squeeze (compression); momentum histogram sign/slope = release direction.

### Volume

- **OBV:** cumulative volume flow; OBV trend confirming/diverging from price = conviction signal.
- **CMF:** -1..+1 money-flow; >0 accumulation / <0 distribution; zero-line flip = flow shift.
- **VWAP:** session volume-weighted avg (intraday only); price vs VWAP = institutional fair-value bias.
- **Buy/Sell Volume:** buy/(buy+sell) ratio; ≥0.65 buy pressure / ≤0.35 sell pressure; price-volume divergence = exhaustion.
- **Volume Profile:** volume-by-price; POC / high-volume nodes = magnet levels, low-volume gaps = fast-move zones.

<!-- PROMPT_DIGEST:START -->
Indicator Core — one-line reference for every computed indicator. Interpret ONLY the values present in this prompt's indicator section; a fuller guide is injected separately only when an indicator is currently notable.
Momentum/Oscillators:
- **RSI(14):** >70 overbought / <30 oversold; 50 line = momentum bias; band-walk in strong trends, divergence = reversal warning.
- **Stochastic(%K/%D):** >80 overbought / <20 oversold; %K crossing %D = momentum shift.
- **StochRSI:** 0–1 scale; >0.8 overbought / <0.2 oversold (more sensitive than RSI).
- **Williams %R:** >-20 overbought / <-80 oversold (inverted scale).
- **CCI:** >+100 strong up / <-100 strong down; zero-line cross = trend bias change.
- **MFI(14):** volume-weighted RSI; >80 overbought / <20 oversold.
Trend:
- **MA/EMA stack:** ordering (short>mid>long = up, reversed = down); slope and price-vs-MA = trend strength.
- **MACD:** signal-line cross = momentum turn; histogram = momentum acceleration; zero-line = trend bias.
- **ADX:** >25 trending / <20 ranging (strength only, not direction); pair with DMI for direction.
- **DMI(+DI/-DI):** +DI>-DI = bullish, reversed = bearish; cross = directional shift, weight by ADX.
- **Supertrend:** ATR trailing stop; flip = trend reversal, line = dynamic support/resistance.
- **Parabolic SAR:** dots flip side = trend reversal / trailing-stop trigger.
- **Ichimoku(9,26,52):** price vs cloud (above bullish / below bearish / inside neutral), TK cross, cloud thickness = S/R strength.
Volatility/Bands:
- **Bollinger(20,2):** band-walk = trend continuation; squeeze = pending expansion; %B near 1/0 = band extreme.
- **Keltner(20,2·ATR):** ATR envelope; close beyond band = breakout/breakdown; tighter than Bollinger.
- **Donchian(20):** highest-high / lowest-low channel; break = Turtle breakout, mid = trend reference.
- **ATR:** absolute volatility (stop/position sizing); rising ATR = expanding range.
- **Squeeze Momentum:** Bollinger-inside-Keltner = squeeze (compression); momentum histogram sign/slope = release direction.
Volume:
- **OBV:** cumulative volume flow; confirming/diverging from price = conviction signal.
- **CMF:** -1..+1 money-flow; >0 accumulation / <0 distribution; zero-line flip = flow shift.
- **VWAP:** session volume-weighted avg (intraday only); price vs VWAP = institutional fair-value bias.
- **Buy/Sell Volume:** buy/(buy+sell) ratio; ≥0.65 buy pressure / ≤0.35 sell pressure; price-volume divergence = exhaustion.
- **Volume Profile:** volume-by-price; POC / high-volume nodes = magnet levels, low-volume gaps = fast-move zones.
<!-- PROMPT_DIGEST:END -->
