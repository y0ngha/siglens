---
title: Piercing Line / Dark Cloud Cover
aliases: [Piercing Line, Dark Cloud Cover, Piercing Pattern]
summary: A two-bar reversal where the second bar goes deeper than half of the first body but doesn't cover all of it.
seoTitle: Piercing Line and Dark Cloud Cover Candlesticks
seoDescription: How the piercing line and dark cloud cover differ from engulfing patterns and when they carry more weight, along with Siglens' detection rules.
demoCaption: Synthetic, illustrative bars made for this explanation. A bullish bar closing above the midpoint of a long bearish bar (piercing line), and a bearish bar dropping below the midpoint of a long bullish bar (dark cloud cover).
faq:
  - q: How is a piercing line different from a bullish engulfing?
    a: In an engulfing the second bar fully covers the first body. A piercing line goes past half the body but not to the first bar's open. If it closes above the open, it is an engulfing, not a piercing line.
  - q: Is a dark cloud cover a bearish signal?
    a: In Thomas Bulkowski's data the bearish reversal rate was 60%. That is only slightly better than even, so many traders check whether a later close breaks the pattern's low.
---

## How it looks

- Piercing line: a long bearish bar followed by a bullish bar. The bullish bar opens below the prior close and closes above the midpoint of the prior body but below its open.
- Dark cloud cover: a long bullish bar followed by a bearish bar. The bearish bar opens above the prior close and closes below the midpoint of the prior body but above its open.

## What it tells you

The second bar retraced more than half of the prior bar's move. The piercing line reversed a decline and the dark cloud cover reversed an advance, which is a clue that direction may change.

## How Siglens detects it

The first bar must be a long bar whose body is at least 60% of its high-to-low range. Textbooks require the second bar to open with a gap beyond the prior bar's low (piercing line) or high (dark cloud cover), but Siglens accepts an open beyond the prior bar's close. The second close must pass the midpoint of the first body but not reach the first bar's open. If it closes fully beyond the first body, Siglens treats it as an [engulfing](/guide/candlesticks/bullish-engulfing), not this pattern. The preceding trend is not checked.

In Thomas Bulkowski's data the bullish reversal rate for the piercing line was 64% and the bearish reversal rate for the dark cloud cover was 60%. Those reversal rates are only a little above chance. But once a direction appears, the trend tends to continue, so overall performance ranks well: 13th of 103 for the piercing line and 22nd for the dark cloud cover.

It carries more weight when:

- A clear trend came right before the pattern
- The bodies are large and the second close goes well past the midpoint
- A piercing line is near support, or a dark cloud cover near resistance
- The second bar's volume is above normal

## Watch out for

Confirmation is a close beyond the far end of the pattern: above the high for a piercing line, below the low for a dark cloud cover. Until then it is only a clue. A piercing line is weak in a sideways market ([ADX](/guide/indicators/adx) below 20) or inside a strong downtrend. Bulkowski also advised avoiding piercing lines when the larger trend is down.
