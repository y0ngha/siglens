---
title: Elder Impulse System
aliases: [Elder Impulse, Impulse System, Elder Impulse System indicator]
summary: Paints bars green, red or blue to show which trade direction is off limits. Not a buy or sell signal.
seoTitle: "Elder Impulse System: What the Bar Colors Mean"
seoDescription: What green, red and blue bars mean in the Elder Impulse System, which trade direction each color blocks, and why it shouldn't be used as a standalone signal.
demoCaption: Synthetic, illustrative bars. Colors come from the 13-bar EMA and the MACD histogram. Green bars continue through an advance and then change to blue and red.
faq:
  - q: Does a green bar mean I should buy?
    a: No. Green means buying is allowed and short selling is blocked, not that you should buy. If you trade on the color alone, you end up buying and selling too often.
  - q: What do red and blue mean?
    a: Red blocks buying (only selling is allowed), and blue allows both directions. Blue means trend and momentum disagree.
  - q: How should I evaluate how it performs?
    a: Not by the returns of the indicator alone. It is a tool to judge by how much better a separate entry method gets when this filter is added.
---

## How it's calculated

The Elder Impulse System was introduced by Alexander Elder in "Come Into My Trading Room" (2002). It colors each bar by combining trend and momentum.

- Green: a bar where the 13-bar [EMA](/guide/indicators/ema) is rising from the previous bar and the [MACD](/guide/indicators/macd) histogram is also rising from the previous bar
- Red: a bar where both are falling from the previous bar
- Blue: everything else (the two disagree, or one of them is unchanged)

MACD uses the standard (12, 26, 9). The 13-bar EMA captures trend inertia and the MACD histogram captures the change in momentum, so a bar turns green or red only when the two point the same way.

## What it tells you

Elder himself called this a censorship rule, not an entry rule. His words: it doesn't tell you what to do, it tells you what you must not do.

- Green: buying is allowed and short selling is prohibited.
- Red: short selling is allowed and buying is prohibited.
- Blue: trend and momentum disagree, so neither direction is blocked.

The moments that matter most are when the color changes (green to blue, blue to red, and so on), because what is prohibited changes. Elder's advice was to "enter cautiously and get out fast."

## How Siglens detects it

Siglens calculates a color for every bar from the 13-bar EMA and the MACD (12, 26, 9) histogram. It singles out this indicator when the last bar is green or red, or when the color changed from the previous bar. Green and red are states that block one direction, and when the color changes, the blocked direction changes too.

When Siglens checked later returns from the colors alone, there was no clear difference. That is an expected result, because a censorship rule is not a tool that earns money by itself. It is a tool you attach to another entry method to filter out entries against the trend. So Siglens uses this indicator as a filter that permits a direction, not as a buy or sell signal.

For example, the bearish signal at the overbought extreme of daily [Bollinger %B](/guide/indicators/bollinger-percent-b) is accepted only when the impulse is red or blue, and filtered out when it is green. The clearer the trend in a market, the more costly counter-trend entries are, so this filter is more useful there.

## Watch out for

- Don't evaluate it by returns from the colors alone. It is a filter, so judge it by how much better the results get when attached to another entry method.
- Green and red are permissions, not buy or sell signals. If you trade on the color alone, you end up buying and selling too often.
- It inherits the lag of the EMA 13 and the MACD histogram, so the color can change a bar or two after the actual turn.
