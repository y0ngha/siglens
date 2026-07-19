# Free Analysis Tier Gating Design

- Date: 2026-07-12
- Scope: `siglens-core` and `siglens`

## Goal

Keep basic technical analysis available to the `free` tier while making the
`member` tier the boundary for intraday analysis and detailed reports. A
registered user starts at `member`; an unauthenticated user is `free`.

## Decisions

| Area | Decision |
| --- | --- |
| Timeframes | `free` may analyze only `1Day`. `member` and `pro` may analyze every supported hourly and minute timeframe. |
| Enforcement | Disable unavailable timeframe controls in the app, normalize invalid `tf` query parameters to `1Day`, and reject the same request in the core submit path. |
| Skill budget | For `free`, select at most three skills per `SkillType` immediately before prompt assembly. `member` and `pro` use the complete selected set. |
| Detailed response | The core masks free-only restricted fields before returning data to siglens. `member` and `pro` receive every report field. The app renders locked placeholders rather than receiving hidden values. |
| Signup prompt | Each locked analysis section presents a signup CTA. |
| Shared analysis | A free user's shared snapshot contains the same filtered result they received, but the share page renders it without a blur or signup CTA. Member and pro snapshots remain complete. |
| Other tier policies | Model availability and daily usage limits remain unchanged in this release. |

## Core Design

### Granular policy switches

The existing tier configuration currently uses one global restriction flag.
Split its consumption so this release can activate only:

- timeframe restrictions;
- analysis information-depth filtering.

Model availability and daily usage helpers continue to observe their current
unrestricted behavior. The `free` timeframe list remains `['1Day']`; both
`member` and `pro` lists contain every value in `TIMEFRAMES`. The `member` and
`pro` information-depth lists both contain every report depth, so only `free`
receives locked fields.

### Server-authoritative timeframe validation

`submitAnalysis` receives the resolved user tier for every technical analysis,
including requests that omit a model id. The core validates the requested
timeframe against the enabled timeframe policy before a job is submitted.

This protects direct server action calls and query-parameter deep links. The
app's URL normalization is a user-experience layer only, not the security
boundary.

### Free prompt skill selection

Add a tier-aware prompt selection limit before context and relevance filtering,
but after the skill catalog is loaded. For `free`, group the catalog by
`SkillType` and choose up to three from each group. The selection seed derives
only from cache-key inputs known before a cache read: analysis kind, symbol or
category, model, timeframe or period, reasoning mode, and catalog fingerprint.
This makes the random-looking selection reproducible in submit, poll, and
read-only cache peek paths.

The selected-skill fingerprint becomes part of the analysis cache input. This
prevents a cached free result built with one random selection from being reused
as though it were built with another selection. The normal catalog fingerprint
continues to invalidate cache entries after skill content changes.

Apply this selection policy to every prompt builder that uses `selectSkills`,
including technical, fundamental, financials, symbol news, and market-news
digest prompts. Prompt assembly changes require the relevant prompt-template
version increments.

### Free response redaction

Use the existing `filterAnalysisResult` contract with the information-depth
policy enabled. `free` retains direction and summary, while unavailable detail
fields are replaced with `null` and reported through `lockedInfoDepth`.

The original worker result remains internal to the analysis cache. The
response returned to a free interactive analysis is the filtered payload only,
so browser network inspection cannot recover locked analysis values.

### Static-safe initial report

The symbol route remains ISR-rendered and must never serialize a complete AI
report in its static HTML or RSC payload. Its cache peek is projected through
the free filter before being passed to the client, so the initial report can
contain only direction and summary plus locked-depth metadata.

After hydration, the existing tier-aware submit action runs once with
`force=false`. It returns a tier-projected cache hit when warm, replacing the
initial preview without another model call or worker job. On a cache miss, the
same action enqueues once and returns the result filtered for the tier that
created the job.

Do not use cookie-aware server rendering or re-enable PPR for this feature:
the project intentionally keeps PPR disabled and relies on ISR for symbol-page
SEO and origin-cost control.

## Siglens Design

### Tier resolution and action adapter

Resolve the current user once for every technical-analysis submit request.
Pass `free` for an unauthenticated request and the account tier otherwise,
regardless of whether a model id is supplied. Preserve the existing BYOK and
model handling for requests that do specify a model. The existing non-forced
submit call replaces the static free preview after authentication state is
known.

### Timeframe control and query parameter

The symbol timeframe hook reads the hydrated user tier and computes allowed
timeframes with the public core helper. It waits for the user lookup before
normalizing a non-daily query, so an authenticated member is not temporarily
redirected to `1Day`. Once resolved, an invalid free `tf` query value is
replaced with `1Day` without scrolling. The same normalization cancels stale
work and requests daily bars.

The timeframe selector renders unavailable free-tier values with a lock icon
and a disabled button. It never invokes bar prefetching or analysis restart for
a disabled timeframe.

### Locked report presentation

Thread `lockedInfoDepth` from submit and poll results through the analysis
hook into `AnalysisPanel`. Map each missing data group to an unchanging-size
locked report block. The block uses a blurred visual placeholder and a clear
signup CTA, while the actual detailed values are absent from the response.

Direction and summary remain readable for `free`. Repeated groups sharing the
same information-depth level render one coherent locked section rather than
nesting multiple overlays. Member and pro responses have no locked metadata
and preserve current rendering.

### Sharing exception

The share view continues to use its immutable client-provided snapshot. A free
user's snapshot therefore contains only the same filtered fields visible in the
interactive result. The share schema and read-only panel accept this safe,
partial chart result and omit unavailable sections without rendering a lock,
blur, or signup CTA.

Member and pro snapshots retain the complete result. No new cache lookup or
server-side original-result retrieval is added to the share flow.

## Error Handling

- An unauthorized timeframe request returns the existing structured tier-gate
  error before job enqueueing.
- An invalid free URL always converges on `1Day`; it cannot loop because the
  normalized value is allowed for every tier.
- Empty skill types remain valid and produce no prompt section rather than a
  filler skill.
- Seeded selection never mutates the loaded skill catalog.
- Existing cache entries are separated by the prompt version and selected-skill
  fingerprint.

## Test Plan

### siglens-core

- `free` allows only `1Day`; `member` and `pro` allow every supported
  timeframe.
- The submit path rejects a free intraday request before worker submission and
  accepts the same request for a member.
- Free skill selection contains no more than three entries for each `SkillType`,
  is reproducible for the same seed, and does not affect member or pro output.
- Cache inputs differ when the selected free skill fingerprint differs.
- Filtering a free result retains only allowed fields and lists the expected
  locked depths; member and pro retain every field.

### siglens

- `submitAnalysisAction` passes `free` for guests and the account tier for a
  member even without a model id.
- The static symbol route serializes no free-locked analysis values. After
  hydration, the tier-aware cached-result action replaces the safe preview
  with the full member result without starting another worker job.
- A free `tf=5Min` URL is replaced with `tf=1Day`; member URLs are preserved.
- Free intraday controls are disabled and member controls are enabled.
- Locked analysis blocks show their signup CTA without rendering restricted
  values.
- A free shared snapshot renders its available fields without a locked block or
  signup CTA; a member shared snapshot retains every field.

## Release Order

1. Merge and release `siglens-core` with the new tier policy, prompt version,
   prompt selection fingerprint, and filtered-result contract.
2. Update the `@y0ngha/siglens-core` dependency in `siglens`.
3. Implement the app adapter, query normalization, disabled controls, and
   locked report presentation.
4. Run scoped tests, type checks, lint, and the relevant guest/member/share
   browser scenarios.
