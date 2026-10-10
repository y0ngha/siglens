---
title: Gap Continuation (Tasuki Gap, On Neck, In Neck)
aliases: [Tasuki Gap, Upside Tasuki Gap, Downside Tasuki Gap, On Neck, In Neck, On-Neck Line, In-Neck Line]
summary: A pullback that stops at a gap or the prior low is read as the trend resting. A weak directional signal.
seoTitle: "Tasuki Gap, On Neck and In Neck: Meaning and Signals"
seoDescription: What upside and downside tasuki gaps, on neck and in neck patterns look like, and where the textbook reading and actual results part ways.
demoCaption: "Synthetic, illustrative bars made for this explanation. An upside Tasuki gap: a bullish bar after a gap up, then a bearish bar that fails to fill the gap."
faq:
  - q: Does a Tasuki gap mean the trend continues?
    a: Textbooks read it that way, but in Bulkowski's data the downside Tasuki gap actually reversed upward more often, at 54%. Direction is close to an even split, so read it only as a resting phase.
  - q: How do on neck and in neck differ?
    a: Both are a bullish bar opening below a long bearish bar. An on-neck closes near the prior low; an in-neck closes slightly above the low, near the prior close.
---

## How it looks

A bar goes against the trend but fails to reverse it. A gap is a stretch where the price ranges of two neighboring bars do not overlap.

- Upside Tasuki gap: three bars. The first is bullish; the second is a bullish bar that gaps up above the first bar's high; the third is a bearish bar that opens inside the second body and closes inside the gap. The third bar does not fill the whole gap.
- Downside Tasuki gap: also three bars. The first is bearish; the second is a bearish bar that gaps down below the first bar's low; the third is a bullish bar that closes inside the gap.
- On neck: a long bearish bar followed by a bullish bar that opens below the prior low and closes near that low.
- In neck: a long bearish bar followed by a bullish bar that opens below the prior low and closes slightly above it, no more than 5% above the prior close.

## What it tells you

A rebound or pullback was blocked at the gap or the prior low. Textbooks read this as the trend pausing, not reversing.

## How SIGLENS detects it

SIGLENS checks only bar shape, not the preceding trend. All four are classified as neutral, with no set direction.

- Upside Tasuki gap: the second bullish bar's low must be above the first bullish bar's high, so there is a gap. The third, bearish bar opens below the second close, and its close must stay above the first bar's high, so the gap is not fully filled. The downside version is the mirror image.
- On neck: the first bearish bar has a long body, at least 60% of its own high-to-low range. The next bullish bar opens below the first bar's low and closes within 0.2% of that low.
- In neck: same conditions, but the bullish bar closes above the first bar's low and no more than 5% above the first bar's close.

In the data of Thomas Bulkowski, who counted what price actually did after each pattern across decades of US stock charts and published the results in books, these shapes did not lean much either way:

- Upside Tasuki gap: 57% upward continuation.
- Downside Tasuki gap: not the textbook downward continuation but 54% bullish reversal, with 46% downward continuation.
- On neck: 56% downward continuation.
- In neck: 53% downward continuation, 47% reversal.

On direction alone they are close to a coin flip, so SIGLENS doesn't read them as directional signals but as a resting phase. Direction is set by whether a later close rises above the pattern's high or falls below its low. Which way price goes is roughly even, but once it breaks out it tends to travel far, so the performance rank (a ranking by how far price went afterward) was high. The upside Tasuki gap ranked 5th of 103 candlesticks.

## Watch out for

If the gap in an upside Tasuki gap is filled later, the continuation read is void. For a downside Tasuki gap, don't assume the decline continues either; the data leaned slightly toward a rebound. Ignore these in a sideways market (where [ADX](/guide/indicators/adx), which measures trend strength, is below 20 and there is no clear direction). In markets that trade around the clock (crypto), true gaps are rare, so be more careful if a gap pattern is flagged there.
