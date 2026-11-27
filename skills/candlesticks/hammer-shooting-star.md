---
name: Hammer/Shooting Star Guide
description: Single-candle reversal pattern interpretation guide (Hammer, Inverted Hammer, Shooting Star, Hanging Man)
type: candlestick
category: neutral
indicators: []
confidence_weight: 0.4
gating:
  tier: gated
  signal_kind: event
  triggers: [hammer, inverted_hammer, shooting_star, hanging_man]
token_cost: 388
digest_hash: "253200e2"
digest_text_hash: "ba8106fb"
---

## Overview

Single candles with one long shadow (≥ 2× the body) and little shadow on the other side.

- **Hammer** / **Hanging Man**: long lower shadow. Textbook: hammer after a decline (bullish), hanging man after an advance (bearish).
- **Inverted Hammer** / **Shooting Star**: long upper shadow. Textbook: inverted hammer after a decline (bullish), shooting star after an advance (bearish).

**How the core names them**: by body color, not by trend. `hammer` / `inverted_hammer` = bullish body;
`hanging_man` / `shooting_star` = bearish body. The prior trend is not checked, so a "hammer" label can
appear at a top. Always read the trend yourself before using the textbook meaning.

## Literature (Bulkowski, not measured by SIGLENS)

- Hammer — Bulkowski (thepatternsite.com/Hammer.html): bullish reversal **60%**; overall performance rank **65 of 103**. Tidbit: white-bodied hammers perform best (matches the core's bullish-body hammer).
- Shooting Star, one-candle — (thepatternsite.com/ShootingStar.html): bearish reversal **59%**; overall rank **55**.
- Hanging Man — (thepatternsite.com/HangingMan.html): textbook bearish reversal, but in his data a **bullish continuation 59%** (bearish reversal only 41%); overall rank **87**.
- Inverted Hammer — (thepatternsite.com/HammerInv.html; Bulkowski defines it as two candles: a tall bearish candle, then the inverted hammer, in a downtrend): textbook bullish reversal, but in his data a **bearish continuation 65%** (bullish reversal only 35%); overall rank **6** (large moves once it breaks).
- Weight 0.4 (weakest labels: Inverted Hammer 35%, Hanging Man 41% in their claimed direction — near random or worse, needs confirmation).

## Signal Interpretation

- **Hammer / Shooting Star** (the pair his study rates better, see above): stronger after a clear prior move, with the long shadow probing a support (hammer) or resistance (shooting star) level, a shadow ≥ 3× the body, and above-average volume.
- **Hanging Man / Inverted Hammer**: do not state the textbook reversal. Bulkowski's study found the existing trend more often continued.
- Confirmation for any of them = a later close beyond the candle's opposite end (above its high for a bullish read, below its low for a bearish read).
- **Ignore** in sideways ranges (ADX < 20). Shadow ratios are unstable on very short timeframes.

## Caveats

- Never trade a single candle alone.
- Never derive a price target from the candle; defer levels to Market Reference / support-resistance.

## AI Analysis Instructions

<!-- PROMPT_DIGEST:START -->
Hammer/Shooting Star Guide (Hammer, Inverted Hammer, Shooting Star, Hanging Man)
- Interpret only if hammer, inverted_hammer, shooting_star or hanging_man is listed in the detected-pattern section.
- Shape: one long shadow ≥ 2× body, little on the other side. Core names by BODY COLOR, not trend: hammer/inverted_hammer = bullish body, hanging_man/shooting_star = bearish body. Check the prior trend yourself before applying any textbook meaning.
- Bulkowski's study (literature, US stocks; not measured by SIGLENS, so describe it in words: never quote its percentages, call them a probability or restate them as a ratio such as 50% or 반반): Hammer (white bodies best) and Shooting Star reversed somewhat more often than not and performed below average. Hanging Man is textbook bearish but more often acted as a bullish continuation, among his weakest performers. Inverted Hammer (Bulkowski: after a tall bearish candle in a decline) more often acted as a bearish continuation and, once price broke out, was among his best performers. Weight 0.4 — near random or worse, needs confirmation.
- Hammer/Shooting Star: stronger after a clear prior move, with the shadow probing S/R, shadow ≥ 3× body, above-average volume.
- Hanging Man/Inverted Hammer: never state the textbook reversal; say Bulkowski's study found the trend more often continued.
- Confirmation = a later close beyond the candle's opposite end (above its high / below its low). Ignore in sideways ranges (ADX < 20).
- Never derive a target; cite levels only from Market Reference / S/R.
<!-- PROMPT_DIGEST:END -->
