---
name: dynamic-decimals-sig-fig-padding
description: shared/lib/priceFormat's dynamicDecimals pads trailing zeros — don't hand-guess exact sub-$1 test strings
metadata:
  type: reference
---

`dynamicDecimals(value)` in `src/shared/lib/priceFormat.ts` returns
`leadingZeros + 4` decimal places (capped at 12), then callers do
`value.toFixed(dynamicDecimals(value))`. This pads trailing zeros beyond the
value's actual significant digits — e.g. `(0.0006).toFixed(7)` is
`"0.0006000"`, not `"0.0006"`. `(0.0004).toFixed(7)` → `"0.0004000"`.

**How to apply:** When writing an exact-string assertion (`toBe(...)`,
`getByText('$0.0006')`) for a sub-$1 formatted value in this codebase, don't
hand-compute the expected string — actually run `node -e "..."` (or reuse the
existing regex-prefix convention, e.g. `toMatch(/^\$0\.0006/)`, that sibling
tests in `PositionHoldingCard.test.tsx`/`PositionBuilding.test.tsx` already
use) to get the real padded value first. A naive guess will produce a test
that fails immediately, not because the code is wrong but because the
expected string was wrong.
