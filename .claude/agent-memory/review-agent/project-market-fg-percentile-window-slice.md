---
name: market-fg-percentile-window-slice
description: siglens-core marketFearGreed module — window-slice O(n) fix and no-look-ahead for-loop pattern verified correct in round 2
metadata:
  type: project
---

`feat/market-fear-greed` (siglens-core) round 2 fixed two recommended findings from round 1:
`distanceFromMa`'s O(n²) prefix-slice (`closes.slice(0, t+1)` then `sma()` internally re-slicing
`-period`) was replaced with `closes.slice(Math.max(0, t + 1 - window), t + 1)` passed directly to
`sma()`. Verified arithmetically identical: `sma(values, period)` does `values.slice(-period)`
internally, so slicing exactly `window` elements up front vs. slicing the whole prefix and letting
`sma` trim it produces the same subarray in both the underfilled (`values.length < period` → both
return `null`) and filled cases.

`computeMarketFearGreedHistory`'s `.map()` + `sample.push` was rewritten as a `for` loop over a
pre-allocated `Array(series.dates.length)`, explicitly mirroring the sibling
`fearGreed/walkForward.ts`'s `computeFearGreedHistory` (same shape: `out[t] = ...` then
`sample.push(current)` *after* composing). This matches MISTAKES.md Coding Paradigm #15.5
(pre-allocated array + for loop is the approved alternative to reduce+spread's O(n²)) and #14.5.

**Why:** confirms the sibling-mirroring approach (rather than inventing a new pattern) is the
correct fix for order-dependent walk-forward accumulation in this codebase — reduce+spread is
banned here specifically because of the O(n²) rule, not because push/mutation is banned outright.

**How to apply:** when reviewing walk-forward / sequential-percentile domain functions in
`domain/indicators/`, check for an existing sibling with the same shape (dates/bars index-based,
no-look-ahead) before flagging `for`+push as a paradigm violation — verify the push happens after
the value it must not see, not before.
