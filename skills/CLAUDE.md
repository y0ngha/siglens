# skills/ — Authoring Guide

How to write and tag the `skills/*.md` files that feed the chart-analysis prompt.
Read this before adding a skill or editing any `gating` frontmatter.

## Why gating exists

The chart prompt selects skills **dynamically by chart state** instead of injecting
all ~90 of them every time. Tagging a skill with `gating` tells the selector *when*
to include it (e.g. only when RSI is oversold, or Bollinger %B is extreme). This
removes irrelevant distraction for floor models and cuts tokens.

**Every skill must declare `gating`.** A skill with **no `gating` block**, or a
malformed/unreachable one, is a **load error** under the selection engine
(siglens-core ≥0.30) — there is no untagged fallback that keeps it always injected.
An untagged skill has no correct default (chart skills and fundamental/news skills
need opposite treatment), so the loader refuses to guess.

**Scope of "load error".** CI (`yarn validate:skills`) rejects a missing or malformed `gating` block in every skill
file. At prompt-build time the app-side `parseGating` (`src/entities/skill/lib/parseGating.ts`) returns `undefined`
for a malformed or unreachable block instead of throwing, and siglens-core's fail-closed `selectSkills` throws on a
whitelisted skill without `gating`: a bad block that slipped past CI fails the analysis, it is never injected silently.

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
| `overlay_kind` | top-level | `divergence` \| `fibonacci` \| `elliott` | **`type: strategy` only** — the one chart overlay kind this strategy's card may draw. core drops any other kind the model cites (the chart menu names a drawing after its card), and a strategy without it draws nothing. Rationale: siglens-core `resolveChartOverlays` (`strategySlotKinds` JSDoc). |

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

`yarn validate:skills` (CI gate) enforces: non-empty on `indicator_guide` with `tier != always_on`, forbidden on every
other type, exact enum values in canonical order (`signal → confirmation → regime → measurement → risk`), no
duplicates. **Exception:** an `always_on` indicator_guide (today only `skills/_core/indicator-core.md`, a compressed
all-indicator reference injected unconditionally) carries no `usage_roles`; the validator enforces the exemption.

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
  an analysis lens): theory strategies (elliott-wave / fibonacci / multi-timeframe),
  S/R, SMC. Chart-pattern skills are **not** in this list — each is
  event-gated on its own chart-pattern pre-screener candidate (see below); the
  always-on `_core/pattern-index.md` covers baseline pattern awareness for every
  chart prompt regardless of which individual pattern skills gate in. Ichimoku
  (`indicators/ichimoku-cloud.md`) is also **not** in this list — it is
  event-gated on cloud breakout/breakdown, not always-on. Fibonacci is the single skill
  `strategies/fibonacci.md`.
- **Fundamental/news skills** — `always_on` **within their own analysis type**:
  fundamental prompts always include the fundamental skills, news prompts always
  include the news skills. This is *not* "always injected everywhere." The
  selection engine applies a category whitelist per analysis type before `tier` is
  even evaluated (TECHNICAL only draws from `_core`/indicators/patterns/strategies/
  candlesticks/support-resistance; FUNDAMENTAL/FINANCIALS only from `fundamental`;
  NEWS only from `news`), so a fundamental/news skill's `always_on` can never leak
  into a chart prompt — the whitelist, not the tier, is what keeps prompts scoped.

## event triggers — the valid catalog

A `triggers` entry falls into one of **three** categories, and a skill's own
`type` determines which one its triggers must draw from — the validator rejects
a trigger from the wrong category even if the name is valid in another:

1. A valid `detectSignals` catalog name (below) — for `indicator_guide`,
   `strategy`, and `support_resistance` skills.
2. A detected candle-pattern name — for `candlestick` skills only.
3. A chart-pattern pre-screener candidate id — for `pattern` skills only. These
   are the `ChartPatternId` values the core's `screenChartPatterns()` can flag —
   the list is `PATTERN_TRIGGER_CATALOG` in `scripts/validate-skills.ts`.

The validator cross-checks each skill's triggers against only the category
valid for its own `type`: a typo'd trigger, or a trigger borrowed from the
wrong category, **fails CI** — it does not silently disappear.

The full signal catalog is `SIGNAL_CATALOG` in `scripts/validate-skills.ts`
(a bidirectional set — each bullish name has a bearish counterpart). Read it
there rather than from a copy here.

For a **candle** skill, the trigger is the candle pattern name (e.g. `hammer`,
`bullish_engulfing`) — anything the core has a label for.

## state pairs — the only valid feature:predicate combos

`state` gating must use one of these pairs (they are the only ones the core's
`isStateNotable` evaluates). Any other pairing is **unreachable** and rejected by CI.
The list is `VALID_STATE_PAIRS` in `scripts/validate-skills.ts` (mirrored in
`src/entities/skill/lib/parseGating.ts` — the two must stay in sync).

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
- `digest_text_hash` is the same hash of the trimmed digest text. `digest-verify`
  fails when either hash is stale, so a hand-edited digest needs
  `yarn skills:digest-update` too, and `digest-update` refuses a body change
  whose digest text did not change since the last update. Pass
  `--digest-unchanged-ok <file...>` (a path is required) only for a body edit
  the digest does not reflect, such as a typo.
- `token_cost` is `Math.ceil(digestText.length / 4)` — recomputed the same way,
  from the digest text alone.
- Re-read the body section the digest summarizes and update both in the same
  change. The digest is the only skill text the prompt sees, so every case it
  covers (setup / near / below / non-daily) must steer the consumer correctly;
  after a digest edit that changes a verdict, run an A/B on the real LLM to
  confirm the output still follows the rule.

**Tooling** (`scripts/skills-digest.ts`): `yarn skills:digest-verify` (read-only; run before pushing a digested
skill) flags a missing digest, malformed markers, a stale `digest_hash`, `digest_text_hash` or `token_cost`;
`yarn skills:digest-update` rewrites the three fields for files whose digest section is valid and is idempotent.

## Keeping a skill consistent

<a id="SK-1"></a>

### SK-1 — Frontmatter, body, digest and examples describe the same behavior

- Frontmatter `indicators` lists every indicator the body references; the body states the capabilities the system
  really has (e.g. the actual recent-bar count), not an idealized one.
- Claims about gating ("always available" vs "injected when the signal fires"), category (neutral vs continuation),
  and numeric evidence match the implementation, the prompt injection and the cited design doc or measurement; a
  cited measurement states its scope (pooled/daily, n, period) and comes from a source the consumed core release
  exports. When quoting a sentence core prints, copy its qualifiers verbatim or defer to the block; never paraphrase.
  When a rule, category or gating changes, update the body, the digest and the index grouping together.
  After a body edit, re-author the digest by hand (see PROMPT_DIGEST markers); `skills:digest-update` refuses a body change whose digest text is unchanged.
- Examples match the condition they illustrate: a "support holds, enter long" example must not use a price below the
  support; a pattern's description must match what it signals (a UTAD signals completed distribution, not buying).
- Adding a skill or changing its display name/summary also updates the skill-card catalog keys in every locale; the
  catalog and hash rules live in `I18N.md#I18-2` and `I18N.md#I18-3`.

<a id="SK-2"></a>

### SK-2 — Reference only what the pinned core emits

A skill may only refer to prompt sections and fields that the consumed `@y0ngha/siglens-core` version renders. Check
the core prompt builder before writing "if the X line is included" or "interpret only if listed in Y". When a new core
version adds a field, write a fallback ("use the computed line when present, otherwise the old comparison") so the
skill still works on the previous version.

- ❌ Instructing the model to compare a "Gap" line the pinned core does not yet emit — the instruction fails silently.

<a id="SK-3"></a>

### SK-3 — When an exclusive rule changes, update every restatement

An exclusive rule (allowed sources, permitted values) is usually restated in the skill body, the digest, the output
rules and injected directives. Grep the rule name and its synonyms by the claim's meaning, not only the exact phrase,
across skills, prompt and directive files, and update all restatements in the same change (also after removing a
claim, in every skill's body and digest). A/B on the real LLM when the rule affects instruction following.
This includes the always-on index (`skills/_core/pattern-index.md`): grep the rule and its synonyms in both its body
and its `PROMPT_DIGEST`, and also in intro, "beyond this catalog" and notation passages, since a gated-doc edit that
leaves the index restating the old rule is the usual miss.

- ❌ Changing "geometry only from a listed Candidate id" in one passage while the intro and digest header still say the old rule.
- ✅ Grep `geometry` / `Candidate id` across the index body and `PROMPT_DIGEST` and rewrite every passage that restates the rule in the same change.
(General version: `CONVENTIONS.md#CS-8`.)

## How to add a new skill / strategy

1. **Pick the tier** per "tier: always_on" above. A `type: pattern` skill is always `tier: gated` on its own
   `ChartPatternId` event trigger; never leave `gating` off.
2. **If gated, pick the kind:**
   - **event** — there is a catalog signal, candle pattern, or chart-pattern
     pre-screener candidate that should turn it on. Add `signal_kind: event` + a
     non-empty `triggers` list drawn from the category that matches this skill's
     `type` (indicator/strategy/S-R → `detectSignals` names, `candlestick` →
     candle names, `pattern` → `ChartPatternId` values).
   - **state** — it's a persistent condition (overbought, band-proximity, etc.).
     Add `signal_kind: state` + a `state: { feature, predicate }` from the valid pairs.
3. Leave `token_cost`, `digest_hash` and `digest_text_hash` to the digest tooling — never hand-set them.
   If/when the skill gets a `PROMPT_DIGEST` section (see below), run
   `yarn skills:digest-update` to compute both. Add `smc_full_guide: true` only on
   the SMC guide.
4. **Run `yarn validate:skills`** (a CI gate; see "event triggers" and "state pairs" above for what it rejects).

> Adding a strategy that fires on an *existing* signal = frontmatter-only change (zero
> core code). Only a genuinely new signal kind needs a core `detectSignals` change.
