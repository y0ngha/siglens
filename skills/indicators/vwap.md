---
name: VWAP Signal Guide
description: VWAP 신호 해석 가이드 — 장중 공정가치, 지지/저항, 브레이크아웃 신호
type: indicator_guide
indicators: ['vwap']
confidence_weight: 0.8
usage_roles: [signal, confirmation, measurement]
computed_card: vwap
gating:
  tier: gated
  signal_kind: state
  state:
    feature: vwap
    predicate: bandDistAtr
token_cost: 456
digest_hash: "c947b632"
digest_text_hash: "5a65db73"
---

## Overview

VWAP (Volume Weighted Average Price) is the cumulative average price weighted by volume, reset at the start of each trading session. It represents the average price at which all shares have been transacted throughout the day, making it the institutional benchmark for fair value. VWAP is primarily an intraday tool and its significance diminishes on daily or longer timeframes.

## Signal Interpretation

### Price Position Relative to VWAP

- Price above VWAP: buying pressure is dominant; the majority of volume has transacted at prices below the current level, suggesting buyers are in control. This is a bullish intraday bias — institutions accumulated below this level.
- Price below VWAP: selling pressure is dominant; the majority of volume transacted above the current price. This is a bearish intraday bias.
- Price oscillating around VWAP: a consolidation zone; neither buyers nor sellers have definitively won. A breakout from this zone, with volume confirmation, is meaningful.

### VWAP as Support and Resistance

- Price pulling back to VWAP from above and holding: VWAP is acting as support — a buying opportunity in the direction of the prevailing trend.
- Price rallying to VWAP from below and stalling: VWAP is acting as resistance — a potential short entry point.
- Note when the session traded heavy volume near the VWAP level; this is an observation, not a strength claim.

### VWAP Breakout Signals

- Price breaking above VWAP with above-average volume: bullish signal — institutional buying may be driving the move. An intraday long-entry candidate.
- Price breaking below VWAP with above-average volume: strong bearish signal — sellers have pushed through institutional fair value.
- Volume is essential to validate a VWAP breakout. A breakout on low volume is likely a false move.

### VWAP Deviation and Extremes

- Price significantly above VWAP (> 1–2% in stocks): extended beyond fair value — mean reversion risk increases, especially in low-volatility environments.
- Price significantly below VWAP: deeply discounted relative to fair value — potential institutional buying interest (support zone).

## Timeframe Context

- VWAP is most meaningful for intraday (1-minute to 15-minute) analysis where session-based volume accumulation is relevant.
- On hourly charts, VWAP is still useful as a reference level for the current session.
- On daily and longer bars, VWAP loses its analytical value unless using an anchored VWAP from a significant event (earnings release, gap day, swing low/high).

## Key Combinations

- VWAP + Volume: VWAP alone is insufficient — volume at the point of breakout is the confirmation. High-volume VWAP breaks are the breaks with volume confirmation.
- VWAP + Stochastic RSI: VWAP provides the directional bias; Stochastic RSI identifies the short-term entry timing within that bias.
- VWAP + Volume Profile: VWAP and POC (Point of Control) convergence zones are worth mentioning as an observation. When VWAP is near the POC, the time-based average and the volume-distribution peak sit at about the same price; make no strength claim.

## Caveats

- VWAP is session-based. Its value resets each day, making it irrelevant as a multi-day support/resistance level in most cases.
- On daily and longer bars, VWAP represents the session average rather than a standard chart-based VWAP. Its interpretation differs from intraday use.
- Do not use VWAP alone as a decision tool. It is most effective when combined with volume analysis and trend context.
- **Late-session volume sensitivity**: VWAP is an equally weighted volume-price average across the session, so a single high-volume bar late in the day (e.g., a closing auction surge, block print, or news-driven spike) can pull VWAP significantly. This can create a distorted reference level that persists into the next session if an anchored VWAP is carried over. On days with heavy late-session volume, re-assess VWAP reliability before treating it as fair value.

<!-- PROMPT_DIGEST:START -->
### VWAP — intraday volume-weighted fair value (resets each session)

Institutional fair-value benchmark. Primarily intraday; significance diminishes on daily and longer bars.

**Price position:**
- Above VWAP = buying pressure dominant, bullish intraday bias (institutions accumulated below).
- Below VWAP = selling pressure dominant, bearish intraday bias.
- Oscillating around VWAP = consolidation; breakout WITH volume confirmation is meaningful.

**Support/Resistance:**
- Pullback to VWAP from above & holding = support (buy in direction of prevailing trend).
- Rally to VWAP from below & stalling = resistance (short entry).
- Note when the session traded heavy volume near the level (an observation, no strength claim).

**Breakout:**
- Break above VWAP with above-average volume = bullish, intraday long-entry candidate.
- Break below with above-average volume = strong bearish.
- Volume essential — low-volume break likely false.

**Deviation/extremes:**
- Price >1–2% above VWAP = extended, mean-reversion risk (esp. low-vol).
- Price significantly below VWAP = deeply discounted, potential institutional buying (support).

**Timeframe:** most meaningful intraday (1–15min); hourly still useful; daily and longer bars lose value unless anchored VWAP from a significant event (earnings, gap day, swing high/low).

**Combos:** +Volume (volume confirms the breakout); +Stochastic RSI (VWAP = bias, StochRSI = entry timing); +Volume Profile (VWAP near POC = same price, an observation, no strength claim).

**Caveats:** session-based, resets daily — not a multi-day S/R level; daily bars = session average not standard VWAP; don't use alone; late-session volume sensitivity — single high-volume late bar (closing auction, block print, news spike) can distort VWAP; re-assess reliability on heavy late-session days.
<!-- PROMPT_DIGEST:END -->
