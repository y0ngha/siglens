# skills/ — Authoring Guide

How to write and tag the `skills/*.md` files that feed the chart-analysis prompt.
Read this before adding a skill or editing any `gating` frontmatter.

## Why gating exists

The chart prompt selects skills **dynamically by chart state** instead of injecting
all ~70 of them every time. Tagging a skill with `gating` tells the selector *when*
to include it (e.g. only when RSI is oversold, or Bollinger %B is extreme). This
removes irrelevant distraction for floor models and cuts tokens.

**Every skill must declare `gating`.** A skill with **no `gating` block**, or a
malformed/unreachable one, is a **load error** under the selection engine
(siglens-core ≥0.30) — there is no untagged fallback that keeps it always injected.
This retires the old fail-open behavior (untagged → always included), which existed
before the engine applied a per-analysis-type category whitelist; once that
whitelist exists, an untagged skill has no correct default (chart skills and
fundamental/news skills need opposite treatment), so the loader refuses to guess.
The CI validator (`yarn validate:skills`, `scripts/validate-skills.ts`) rejects a
missing/malformed `gating` block before it ships — every skill file, chart or
fundamental/news, must carry an explicit `tier`.

**Scope of "load error" — CI vs. runtime.** The two enforcement points land on
different timelines and must not be conflated:

- **CI (this repo, today):** `yarn validate:skills` rejects a missing or
  malformed `gating` block for every skill file. This is authoring-time
  enforcement — it stops a new untagged skill from ever being committed.
- **Runtime (siglens-core ≥0.30, not yet shipped):** the selection engine's
  fail-closed behavior described above — treating an untagged/unreachable
  skill as a load error at prompt-build time — arrives with that engine.
  Until it ships, this repo's app-side parser
  (`src/entities/skill/api.ts`'s `parseGating`) still **fail-opens** at
  runtime: it mirrors the pre-≥0.30 core loader and returns `undefined`
  (treated as untagged) for a malformed/unreachable block rather than
  throwing. That parser is deliberately left unchanged in this PR: 100% of
  skill files are CI-tagged today, so the fail-open path is currently
  unreachable in practice, but the runtime code itself does not yet enforce
  the policy — only CI does.

## Frontmatter `gating` schema

All keys are **snake_case**; the loader maps them to camelCase `Skill` fields.

| Key | Where | Values | Notes |
|---|---|---|---|
| `gating.tier` | required | `always_on` \| `gated` | `always_on` → injected unconditionally; `gated` → injected only when its trigger fires |
| `gating.signal_kind` | `gated` only | `event` \| `state` | picks the gating path |
| `gating.triggers` | `event` only | `[signal_name, ...]` | each must be a valid catalog name or a detected candle pattern; non-empty |
| `gating.state` | `state` only | `{ feature, predicate }` | must be one of the valid pairs below; optional `hi`/`lo` numeric thresholds |
| `token_cost` | top-level | number | **measured token estimate of the skill's `PROMPT_DIGEST` section** (`Math.ceil(digestText.length / 4)`) — maintained by `yarn skills:digest-update`, checked by `yarn skills:digest-verify`. See [PROMPT_DIGEST markers](#prompt_digest-markers) below. Do not hand-set it. |
| `smc_full_guide` | top-level | `true` | **SMC full-guide skill only** — identifies it so a compressed note can replace it |

## confidence_weight

`confidence_weight` (0.0–1.0) is a **display weight** — it maps to a Low / Medium / High
label shown in the Skills UI. It does **not** exclude a skill from the analysis prompt;
all skills are injected regardless of value.

| Range | Label | Prompt treatment |
|---|---|---|
| `< 0.5` | Low | Included, shown with `[낮은 신뢰도]` label |
| `0.5 – 0.8` | Medium | Included, shown with `[중간 신뢰도]` label |
| `>= 0.8` | High | Included, shown with `[높은 신뢰도]` label |

Note: `confidence_weight` represents an *analysis weight*, not a hit-rate or probability.

## usage_roles (indicator_guide skills only)

`usage_roles` is **required** on every `type: indicator_guide` skill that is not
`gating.tier: always_on`. Set it to a non-empty subset of the allowed roles:

```
signal        # primary entry/exit signal generator
confirmation  # confirms signals from other indicators
regime        # identifies market regime / trend context
measurement   # quantitative measurement (momentum level, volatility, etc.)
risk          # risk assessment or stop-loss guidance
```

**Rules enforced by `yarn validate:skills` (CI gate):**

- Non-empty array required on `indicator_guide` with `tier != always_on`.
- Forbidden on all other skill types (`pattern`, `strategy`, `candlestick`, `support_resistance`).
- Values must be the exact enum above — no free-form strings.
- Must follow canonical order: `signal → confirmation → regime → measurement → risk`.
- No duplicates.

**Exception — `gating.tier: always_on` indicator_guide:** exempt from `usage_roles`.
The only current example is `skills/_core/indicator-core.md`, which is a compressed
all-indicator reference injected unconditionally. Because it summarises every indicator
rather than routing a single one, per-role tagging does not apply. The validator
enforces this exemption explicitly.

**Example:**

```yaml
type: indicator_guide
usage_roles: [signal, confirmation]
gating:
  tier: gated
  signal_kind: event
  triggers: [rsi_oversold, rsi_overbought]
```

## tier: always_on — chart skills vs fundamental/news skills

Every skill declares `gating.tier`; there is no untagged state. `always_on` means
different things depending on which analysis type the skill belongs to:

- **Chart skills** — chart-relevant, deliberately ungated (no detector, or used as
  an analysis lens): chart-patterns, theory strategies
  (elliott-wave / fibonacci / multi-timeframe), S/R, Ichimoku, SMC.
- **Fundamental/news skills** — `always_on` **within their own analysis type**:
  fundamental prompts always include the fundamental skills, news prompts always
  include the news skills. This is *not* "always injected everywhere." The
  selection engine applies a category whitelist per analysis type before `tier` is
  even evaluated (TECHNICAL only draws from `_core`/indicators/patterns/strategies/
  candlesticks/support-resistance; FUNDAMENTAL/FINANCIALS only from `fundamental`;
  NEWS only from `news`), so a fundamental/news skill's `always_on` can never leak
  into a chart prompt — the whitelist, not the tier, is what keeps prompts scoped.

Every skill file — chart, fundamental, or news — sets an explicit `tier`.

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

## PROMPT_DIGEST markers

A skill file may carry a compressed, prompt-facing rewrite of its body — the
**digest** — delimited by a marker pair that every digested skill **must** have
exactly one of, appended once at the very end of the file, after the body:

```
<!-- PROMPT_DIGEST:START -->
...digest text...
<!-- PROMPT_DIGEST:END -->
```

- **What gets injected into the AI prompt is the digest, not the full body.**
  The full body stays the human-facing authoring source (what you read/edit in
  this repo); the digest is the token-cheap rewrite the selector actually sends
  when the skill fires.
- The digest text itself is always **hand-authored** — no script writes it.
- Exactly one `START`/`END` pair, in that order, with nothing but whitespace
  after `END`. Duplicate markers, a `START` with no matching `END`, an
  `END` with no `START`, or trailing content after `END` are all rejected as
  malformed by `yarn skills:digest-verify`.
- `digest_hash` is the first 8 hex chars of `SHA-256(original body)`, computed
  **at digest-authoring time** — it fingerprints the body the digest was
  written against, not the digest text itself. If the original body changes
  later and `digest_hash` isn't refreshed to match, `verify` reports a
  **hash-mismatch**: that means **the digest is stale** (it no longer reflects
  the current body) and must be **re-authored by hand** against the new body,
  then refreshed with `yarn skills:digest-update`.
- `token_cost` is `Math.ceil(digestText.length / 4)` — recomputed the same way,
  from the digest text alone.

**Tooling** (`scripts/skills-digest.ts`):

- `yarn skills:digest-verify` — read-only. Flags any file with a missing
  digest, malformed markers, a stale `digest_hash`, or a stale `token_cost`.
  Run before pushing once a skill has a digest section.
- `yarn skills:digest-update` — recomputes and rewrites `digest_hash` +
  `token_cost` in place for every file that already has an `ok` digest
  section; files with no digest, or a malformed one, are left untouched (that's
  `verify`'s job to flag, not this command's to fix). Idempotent — running it
  twice in a row makes zero changes the second time.

## How to add a new skill / strategy

1. **Pick the tier.** Chart-relevant lens or pattern with no detector → `tier: always_on`.
   Fundamental/news with no meaningful trigger → also `tier: always_on` (the
   category whitelist, not the tier, keeps it out of chart prompts) — never leave
   `gating` off.
2. **If gated, pick the kind:**
   - **event** — there is a catalog signal (or candle pattern) that should turn it on.
     Add `signal_kind: event` + a non-empty `triggers` list of known names.
   - **state** — it's a persistent condition (overbought, band-proximity, etc.).
     Add `signal_kind: state` + a `state: { feature, predicate }` from the valid pairs.
3. Leave `token_cost` and `digest_hash` to the digest tooling — never hand-set them.
   If/when the skill gets a `PROMPT_DIGEST` section (see below), run
   `yarn skills:digest-update` to compute both. Add `smc_full_guide: true` only on
   the SMC guide.
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
