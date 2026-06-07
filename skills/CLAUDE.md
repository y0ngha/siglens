# skills/ — Authoring Guide

How to write and tag the `skills/*.md` files that feed the chart-analysis prompt.
Read this before adding a skill or editing any `gating` frontmatter.

## Why gating exists

The chart prompt selects skills **dynamically by chart state** instead of injecting
all ~70 of them every time. Tagging a skill with `gating` tells the selector *when*
to include it (e.g. only when RSI is oversold, or Bollinger %B is extreme). This
removes irrelevant distraction for floor models and cuts tokens.

**Fail-open is the default.** A skill with **no `gating` block** is always included.
A malformed/unreachable `gating` block is treated as untagged (also always included) —
it never silently disappears. The CI validator (`yarn validate:skills`) rejects the
malformed block before it ships, so fail-open is a safety net, not an excuse to skip
validation.

## Frontmatter `gating` schema

All keys are **snake_case**; the loader maps them to camelCase `Skill` fields.

| Key | Where | Values | Notes |
|---|---|---|---|
| `gating.tier` | required | `always_on` \| `gated` | `always_on` → injected unconditionally; `gated` → injected only when its trigger fires |
| `gating.signal_kind` | `gated` only | `event` \| `state` | picks the gating path |
| `gating.triggers` | `event` only | `[signal_name, ...]` | each must be a valid catalog name or a detected candle pattern; non-empty |
| `gating.state` | `state` only | `{ feature, predicate }` | must be one of the valid pairs below; optional `hi`/`lo` numeric thresholds |
| `token_cost` | top-level | number | **currently unused placeholder — set `0`** (reserved for build-time tokenizer baking) |
| `smc_full_guide` | top-level | `true` | **SMC full-guide skill only** — identifies it so a compressed note can replace it |

## tier: always_on vs untagged

Both end up always-injected, but they mean different things:

- **`always_on`** — chart-relevant, deliberately ungated (no detector or used as an
  analysis lens): chart-patterns, theory strategies
  (elliott-wave / fibonacci / multi-timeframe), S/R, Ichimoku, SMC.
- **untagged (no `gating`)** — fail-open inclusion: non-chart fundamental/news skills,
  or indicators with no meaningful trigger.

Prefer an explicit `tier: always_on` for chart skills; leave fundamental/news untagged.

## event triggers — the valid catalog

A `triggers` entry must be **either** a valid `detectSignals` catalog name (below)
**or** a detected candle-pattern name. The validator cross-checks against the core's
exported catalog: a typo'd trigger **fails CI** — it does not silently disappear.

Full signal catalog (bidirectional set):

```
rsi_oversold                         rsi_overbought
rsi_bullish_divergence               rsi_bearish_divergence
golden_cross                         death_cross
macd_bullish_cross                   macd_bearish_cross
macd_histogram_bullish_convergence   macd_histogram_bearish_convergence
bollinger_lower_bounce               bollinger_upper_breakout
bollinger_squeeze_bullish            bollinger_squeeze_bearish
supertrend_bullish_flip              supertrend_bearish_flip
parabolic_sar_flip                   parabolic_sar_bearish_flip
ichimoku_cloud_breakout              ichimoku_cloud_breakdown
cci_bullish_cross                    cci_bearish_cross
dmi_bullish_cross                    dmi_bearish_cross
cmf_bullish_flip                     cmf_bearish_flip
mfi_oversold_bounce                  mfi_overbought_reversal
keltner_upper_breakout               keltner_lower_breakout
squeeze_momentum_bullish             squeeze_momentum_bearish
support_proximity_bullish            resistance_proximity_bearish
```

For a **candle** skill, the trigger is the candle pattern name (e.g. `hammer`,
`bullish_engulfing`) — anything the core has a label for.

## state pairs — the only valid feature:predicate combos

`state` gating must use one of these pairs (they are the only ones the core's
`isStateNotable` evaluates). Any other pairing is **unreachable** and rejected by CI:

| feature | predicate |
|---|---|
| `bollinger` | `pctB` |
| `keltner` | `bandDistAtr` |
| `williamsR` | `level` |
| `stochastic` | `level` |
| `stochRsi` | `level` |
| `donchian` | `channelProximity` |
| `vwap` | `bandDistAtr` |
| `buySellVolume` | `ratio` |

## How to add a new skill / strategy

1. **Pick the tier.** Chart-relevant lens or pattern with no detector → `tier: always_on`.
   Fundamental/news → leave untagged (no `gating` block).
2. **If gated, pick the kind:**
   - **event** — there is a catalog signal (or candle pattern) that should turn it on.
     Add `signal_kind: event` + a non-empty `triggers` list of known names.
   - **state** — it's a persistent condition (overbought, band-proximity, etc.).
     Add `signal_kind: state` + a `state: { feature, predicate }` from the valid pairs.
3. Set `token_cost: 0` (placeholder). Add `smc_full_guide: true` only on the SMC guide.
4. **Run `yarn validate:skills`.** It cross-checks every trigger against the core
   catalog and every state pair against `isStateNotable`, rejecting typos and
   unreachable combos. This is a **CI gate** — a bad tag fails the build.

> Adding a strategy that fires on an *existing* signal = frontmatter-only change (zero
> core code). Only a genuinely new signal kind needs a core `detectSignals` change.

## Validation

`yarn validate:skills` is wired into CI. Run it locally before pushing.

**Worked examples**

Event-gated indicator guide (RSI):

```yaml
gating:
  tier: gated
  signal_kind: event
  triggers: [rsi_oversold, rsi_overbought, rsi_bullish_divergence, rsi_bearish_divergence]
token_cost: 0
```

State-gated indicator guide (Bollinger %B):

```yaml
gating:
  tier: gated
  signal_kind: state
  state:
    feature: bollinger
    predicate: pctB
token_cost: 0
```
