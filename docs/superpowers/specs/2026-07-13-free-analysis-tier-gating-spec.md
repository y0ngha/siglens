# Free Analysis Tier Gating

## Goal

`free` visitors may run technical analysis only for the daily timeframe. `member`
and higher tiers may use every supported timeframe, including intraday minute
timeframes. The server is the authority for this policy; client controls are
only a usability layer.

## Scope

- Core resolves tier policy and rejects unauthorized submissions and polls.
- The app disables unavailable timeframe controls, rejects unavailable bars
  Server Action requests, and canonicalizes an unauthorized `tf` query to
  `1Day` after tier hydration.
- `free` analysis prompts sample at most three skills per skill type.
- Core removes gated detail from every free response. The app renders the
  omitted detail as a signup teaser rather than fabricating analysis values.
- Share snapshots retain the analysis supplied to the share flow and do not
  render signup blur UI.

## Invariants

1. `free` may submit, cache-read, static-peek, and poll only `1Day` analysis.
   The bars Server Action also rejects a free intraday request so a direct
   action invocation cannot bypass the selector.
2. `member` and higher may submit all registered timeframes, including minute
   and hour timeframes.
3. An SSR response is treated as free-safe until client tier hydration
   completes. A resolved tier transition refetches analysis and must not leave
   privileged detail in the DOM or chat context.
4. Core caches raw worker output internally, but its public free response has
   no gated detail fields. Cache keys and prompt fingerprints include tier and
   sampled skill identity where relevant.
5. A job created under a higher tier cannot be polled by a current `free`
   caller when its timeframe is unavailable to `free`. Both the technical poll
   and the overall poll enforce this caller-tier timeframe gate, and the
   overall content-free peek applies the same gate on its read path.
6. Failure to resolve the app caller tier polls as `free`, never as an
   implicitly privileged tier.
7. Congressional analysis receives the resolved tier for every request, not
   only requests with reasoning enabled.

## Non-goals

- Changing global usage limits or model entitlements.
- Restricting existing public facts, prices, or share snapshot content.
- Altering the worker's raw persisted analysis schema.

## Deployment Contract

The core package release must complete before the app dependency is bumped.
During a rolling update, a new free client treats a response with missing or
empty `lockedInfoDepth` as unsafe and renders only the lock teaser. This keeps
an old instance's raw response from reaching the new UI. Old clients can render
the new core's filtered shape without exposing gated data. Rollback after this
policy is active must use a version with the same compatibility guard until the
maximum analysis-job TTL has elapsed. The deploy script retains the prior ISR
prefix so rollback does not start with a cold cache.
