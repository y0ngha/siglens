---
name: Ichimoku Cloud Signal Guide
description: 일목균형표(9,26,52) 신호 해석 가이드 — 구름 위치, TK 크로스, 구모 브레이크아웃, 치코우 확인
type: indicator_guide
indicators: ['ichimoku']
confidence_weight: 0.85
usage_roles: [signal, confirmation, regime]
gating:
  tier: always_on
token_cost: 734
digest_hash: "2548155d"
---

## Overview

The Ichimoku Cloud (Ichimoku Kinko Hyo — "equilibrium at a glance") is a multi-component trend system that simultaneously displays support/resistance, trend direction, momentum, and future equilibrium zones. The five components are: Tenkan-sen (conversion line, period 9), Kijun-sen (base line, period 26), Senkou Span A (leading span, projected 26 bars ahead), Senkou Span B (leading span, period 52, projected 26 bars ahead), and Chikou Span (lagging span, current close shifted 26 bars back). The cloud (Kumo) is formed between Senkou Span A and B.

## Signal Interpretation

### Price Position Relative to the Cloud

- Price above the cloud: the market is in a bullish trend — buyers are in structural control. Buy signals from other indicators carry higher reliability in this zone.
- Price below the cloud: the market is in a bearish trend — sellers are in structural control. Sell signals from other indicators carry higher reliability in this zone.
- Price inside the cloud: the market is in a neutral or transitional phase — conflicting forces are at work. Avoid high-conviction directional positions until the price resolves outside the cloud.
- The cloud's thickness reflects support/resistance strength: a thick cloud is difficult to break through; a thin cloud may be penetrated more easily.

### Tenkan-sen and Kijun-sen (TK Cross)

- Tenkan-sen (9-period mid-price) crossing above Kijun-sen (26-period mid-price) — Golden TK Cross: a bullish short-to-medium term signal. Strongest when the cross occurs above the cloud.
- Tenkan-sen crossing below Kijun-sen — Dead TK Cross: a bearish short-to-medium term signal. Strongest when the cross occurs below the cloud.
- A TK cross inside the cloud is a neutral signal; below the cloud it is bearish; above the cloud it is bullish.

### Kumo Breakout

- Price closing above the cloud from below: a major bullish signal — the trend has shifted to an uptrend. This is the most significant single event in Ichimoku analysis.
- Price closing below the cloud from above: a major bearish signal — the trend has shifted to a downtrend.
- The strength of the breakout signal is inversely related to the cloud thickness: a breakout through a thin cloud is more likely to succeed; a breakout through a thick cloud requires additional confirmation.

### Chikou Span Confirmation

- Chikou Span (current close plotted 26 bars ago) above the price candles from 26 bars ago: bullish trend confirmation — the current period's momentum exceeds the historical period's price level.
- Chikou Span below the price candles from 26 bars ago: bearish confirmation.
- Use the Chikou Span as a final confirmation layer: when TK cross, price above cloud, and Chikou above past price all align simultaneously, this is the highest-confidence bullish Ichimoku signal.

### Cloud Shape and Future Structure

- Senkou Span A above Senkou Span B (bullish cloud / green cloud): the projected equilibrium zone is bullish — price has future structural support.
- Senkou Span B above Senkou Span A (bearish cloud / red cloud): the projected equilibrium zone is bearish.
- When the upcoming cloud (26 bars ahead) switches from bearish to bullish (cloud twist): this is a forward-looking bullish indicator — the system projects the balance of power will shift to buyers.

## Three-Signal Alignment

The strongest Ichimoku signals occur when all three layers agree:
1. Price above the cloud (structural bullish position)
2. Tenkan-sen above Kijun-sen (short-term bullish momentum)
3. Chikou Span above past price (historical confirmation)

When all three align, the probability of trend continuation is significantly elevated.

## Key Combinations

- Ichimoku + ADX: When ADX > 25 and price is above the Ichimoku cloud, the trend has both Ichimoku structural support and ADX strength confirmation.
- Ichimoku + Volume Profile: When the Kijun-sen or cloud boundary aligns with the Volume Profile POC, the support/resistance level has dual structural and volume-distribution backing.
- Ichimoku + MA(200): When price is above both the Ichimoku cloud and MA(200), the highest-timeframe trend consensus is bullish.

## Caveats

- In choppy or sideways markets, price repeatedly enters and exits the cloud, generating many conflicting signals — Ichimoku is not effective in ranging conditions.
- The 9/26/52 periods were originally designed for Japanese rice markets trading 6 days a week. Some practitioners adjust to (10/30/60) for 5-day trading weeks.
- Cloud analysis requires patience — meaningful signals emerge over longer time periods. Short-term interpretations of Ichimoku components are prone to noise.
- Chikou Span interpretation requires careful chart reading because it is plotted in a shifted position; automated analysis should reference the actual close vs. the price 26 bars ago.

<!-- PROMPT_DIGEST:START -->
### Ichimoku Cloud (9, 26, 52) — multi-component trend system

Components: Tenkan-sen (conversion, 9), Kijun-sen (base, 26), Senkou Span A (leading, projected 26 bars ahead), Senkou Span B (leading, 52, projected 26 ahead), Chikou Span (close shifted 26 bars back). Cloud (Kumo) = area between Span A and B.

Price vs cloud:
- Above cloud = bullish trend, buyers in control; buy signals from other indicators more reliable here.
- Below cloud = bearish trend, sellers in control; sell signals more reliable here.
- Inside cloud = neutral/transitional, conflicting forces — avoid high-conviction directional positions until price resolves outside.
- Cloud thickness = S/R strength: thick = hard to break, thin = easier to penetrate.

TK Cross:
- Tenkan crosses above Kijun = Golden TK Cross, bullish short-to-medium term; strongest above the cloud.
- Tenkan crosses below Kijun = Dead TK Cross, bearish; strongest below the cloud.
- TK cross inside cloud = neutral; below cloud = bearish; above cloud = bullish.

Kumo breakout:
- Close above cloud from below = major bullish signal, trend shifted to uptrend — the most significant single Ichimoku event.
- Close below cloud from above = major bearish signal, trend shifted to downtrend.
- Breakout strength inversely related to cloud thickness: thin cloud = more likely to succeed; thick cloud = needs extra confirmation.

Chikou Span confirmation:
- Chikou (close plotted 26 bars ago) above the price candles from 26 bars ago = bullish confirmation (current momentum exceeds historical price level).
- Chikou below past-price candles = bearish confirmation.
- Final confirmation layer; when TK cross + price above cloud + Chikou above past price all align = highest-confidence bullish signal.

Cloud shape / future structure:
- Senkou A above Senkou B (bullish/green cloud) = projected equilibrium bullish, future structural support.
- Senkou B above Senkou A (bearish/red cloud) = projected equilibrium bearish.
- Upcoming cloud (26 bars ahead) switching bearish→bullish (cloud twist) = forward-looking bullish; balance of power projected to shift to buyers.

Three-signal alignment (strongest signals): (1) price above cloud, (2) Tenkan above Kijun, (3) Chikou above past price. All three aligned → trend continuation probability significantly elevated (bearish mirror when all inverted).

Confluence: ADX > 25 + price above cloud = structural + strength confirmation. Kijun/cloud boundary aligned with Volume Profile POC = dual S/R backing. Price above both cloud and MA(200) = highest-timeframe bullish consensus.

Caveats: in choppy/sideways markets price repeatedly enters/exits cloud → conflicting signals; ineffective in ranging conditions. 9/26/52 designed for 6-day rice markets; some use 10/30/60 for 5-day weeks. Meaningful signals emerge over longer periods; short-term reads = noise. For automation reference actual close vs price 26 bars ago (Chikou is plotted shifted).
<!-- PROMPT_DIGEST:END -->

