---
title: Gap Continuation (Tasuki Gap, On Neck, In Neck)
aliases: [Tasuki Gap, Upside Tasuki Gap, Downside Tasuki Gap, On Neck, In Neck, On-Neck Line, In-Neck Line]
summary: A pullback that stops at a gap or the prior low is read as the trend resting. A weak directional signal.
seoTitle: Tasuki Gap, On Neck and In Neck Candlesticks
seoDescription: What upside and downside Tasuki gaps and on-neck and in-neck candlesticks look like, where textbooks and data disagree, and how Siglens interprets them.
demoCaption: "Synthetic, illustrative bars made for this explanation. An upside Tasuki gap: a bullish bar after a gap up, then a bearish bar that fails to fill the gap."
faq:
  - q: Does a Tasuki gap mean the trend continues?
    a: Textbooks read it that way, but in Bulkowski's data the downside Tasuki gap actually reversed upward more often, at 54%. Direction is close to a coin flip, so read it only as a resting phase.
  - q: How do on neck and in neck differ?
    a: Both are a bullish bar opening below a long bearish bar. An on-neck closes near the prior low; an in-neck closes slightly above the low, near the prior close.
---

## How it looks

A bar goes against the trend but fails to reverse it. A gap is a stretch where the price ranges of two neighboring bars do not overlap.

- Upside Tasuki gap: a bullish bar, a bullish bar that gaps above the first bar's high, then a bearish bar that opens inside the second body and closes inside the gap. It does not fill the gap.
- Downside Tasuki gap: a bearish bar, a bearish bar that gaps below the first bar's low, then a bullish bar that closes inside the gap.
- On neck: a long bearish bar followed by a bullish bar that opens below the prior low and closes near that low.
- In neck: a long bearish bar followed by a bullish bar that opens below the prior low and closes slightly above it, near the prior close.

## What it tells you

A rebound or pullback was blocked at the gap or the prior low. Textbooks read this as the trend pausing, not reversing.

## How Siglens detects it

Siglens checks only bar shape, not the preceding trend.

- Upside Tasuki gap: the second bullish bar's low must be above the first bullish bar's high, so there is a gap. The third, bearish bar opens below the second close, and its close must stay above the first bar's high, so the gap is not fully filled. The downside version is the mirror image.
- On neck: the first bearish bar has a long body, at least 60% of its high-to-low range. The next bullish bar opens below the first bar's low and closes within 0.2% of that low.
- In neck: same conditions, but the bullish bar closes above the first bar's low and no more than 5% above the first bar's close.

All four are classified as neutral, with no set direction. Thomas Bulkowski's data shows:

- Upside Tasuki gap: 57% upward continuation.
- Downside Tasuki gap: not the textbook downward continuation but 54% bullish reversal, with 46% downward continuation.
- On neck: 56% downward continuation.
- In neck: 53% downward continuation, 47% reversal.

The direction rates are all close to a coin flip. So Siglens doesn't read them as directional signals but as a resting phase. Direction is set by the next close beyond the pattern's high or low. Once a direction appears, the trend tends to continue, so overall performance ranks well. The upside Tasuki gap ranked 5th of 103 candlesticks.

## Watch out for

If the gap in an upside Tasuki gap is filled later, the continuation read is void. For a downside Tasuki gap, don't assume the decline continues either; the data leaned slightly toward a rebound. Ignore these in a sideways market ([ADX](/guide/indicators/adx) below 20). In markets that trade around the clock (crypto), true gaps are rare, so be more careful if a gap pattern is flagged there.
