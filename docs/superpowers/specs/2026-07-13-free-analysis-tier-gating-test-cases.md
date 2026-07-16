# Free Analysis Tier Gating Test Cases

## Core Unit and Integration

1. Free submits `1Day` successfully and free submits every non-daily timeframe
   as a tier error.
2. Member submits `5Min` and other non-daily timeframes (for example `1Hour`)
   successfully.
3. A non-daily job created as member returns an error when polled as free.
4. Free cached reads and static peeks omit every locked detail field; member
   responses retain the full fields.
5. Free prompt construction receives at most three deterministically sampled
   skills per prompt-injection group (fewer when a group has fewer than three).
   Groups are keyed by `skill.type` for technical skills and by
   `skill.category` for the type-less fundamental, news, and congress skills,
   so each category is capped independently and never starved to zero. Member
   prompt construction receives the complete catalog.
6. Cache keys differ for free and member and change when the sampled skill set
   changes.
7. Polling with no caller tier supplied defaults to free policy and never
   returns a privileged response. This covers both the technical poll and the
   overall poll, which share the same caller-tier timeframe gate.

## App Unit and Integration

1. Before tier hydration, non-daily controls cannot navigate, prefetch, or
   increment the timeframe change counter.
2. A free request for a non-daily timeframe renders `1Day`, then canonicalizes
   the URL to `?tf=1Day` after hydration. The unit test drives this with a
   synthetic `1Week` stand-in timeframe to isolate the restore path.
3. A direct free request to `getBarsAction` for a minute or hour timeframe is
   rejected before any market-data provider call; tier-resolution failures use
   the same free policy.
4. A member request for a non-daily timeframe restores that timeframe after
   hydration and triggers one analysis refresh for it. The unit test drives
   this with a synthetic `1Week` stand-in timeframe.
5. A free-to-member or member-to-free tier transition clears the prior result,
   refetches, and never retains privileged detail in the interim DOM.
6. Locked results hide risk and actionable recommendation values, show a signup
   teaser only in the normal analysis view, and do not show it in shares.
7. `submitAnalysisAction`, `pollAnalysisAction`, `pollOverallAnalysisAction`,
   and Congress actions resolve the caller tier and pass it to core, falling
   back to free when tier resolution fails. The static peeks always use the
   free policy (anonymous or bot SSR shell), passing a constant `free` with no
   tier resolution.
8. The app normalizes omitted free fields without displaying fabricated values.
9. The overall page canonicalizes a free `/overall?tf=1Hour` request to daily
   without creating an intraday technical-axis submission; member keeps the
   requested URL and may submit it.

## E2E and Production Evidence

1. Browser tests cover free daily access, disabled intraday controls, direct
   `tf` deep links, member intraday access, and locked-detail signup teasers.
2. Curl against a production-mode local server verifies status codes, canonical
   free query handling, SSR free-safe HTML, metadata, robots, and sitemap
   responses.
3. Chrome verification covers desktop and mobile viewports, direct URL entry,
   disabled control behavior, tier hydration, share rendering, and no console
   errors.
4. Build and start the production artifact with the released core package,
   then repeat the curl and browser checks before opening the app PR.
