---
name: project-chrome-wide-namespace-cascades-to-all-routes
description: siglens-i18n's per-route client message pruning always merges chrome's wideNamespaces into every route — splitting a dynamic-lookup hook into its own file does NOT shrink a route's payload if the namespace is already chrome-wide
metadata:
  type: project
---

`scripts/i18n/extract.mjs`'s route serialization does
`routes[routeId] = { keys: union(chrome.keys, entry.keys), wideNamespaces:
union(chrome.wideNamespaces, entry.wideNamespaces) }` for every route — chrome is
**always unioned in**, never subtracted, because nested `NextIntlClientProvider`s
replace (don't inherit) the parent's `messages` prop, so every page-level provider
must be self-contained including whatever chrome needs.

Consequence: if a dynamic-lookup namespace is already chrome-wide (i.e. some
chrome-rendered file — e.g. the home page's `SkillsShowcase`, which uses the root/chrome
provider — needs it), **every other route's payload floor is chrome's payload size**,
regardless of whether that route's own component tree uses the namespace. Splitting the
namespace into a separate source file (to dodge the variable-name collision in
[[reference_extract_mjs_same_var_name_widening_collision]]) does NOT reduce this — it
was tried and measured zero effect, because chrome's own wideNamespaces already includes
it via the chrome-reachable consumer, and that set gets merged into all routes either way.

Real fix when this pushes `clientKeyCoverage.test.ts`'s "크롬 페이로드가 합집합보다 훨씬
작다" ratio guard over budget: the size increase is often legitimate feature growth (not
waste) — measure the ratio with/without the new group, and if it's a real content addition
(not duplication/bloat), raise the threshold with a comment documenting the before/after
numbers, same as the existing comment already documents an earlier 60.9%→15% reduction.
Don't chase a code-structure workaround for what's actually a data-size problem.

Example: adding `shared.skillDescription` (74 sentences × 4 locales, ~8.5KB) pushed
chrome from 9.3% → 23.8% of the full ko catalog; raised the test's threshold 0.15 → 0.25.
Found on siglens-i18n branch, 2026-08-20, session also produced
[[reference_next_intl_literal_dot_in_message_key]] and
[[reference_extract_mjs_same_var_name_widening_collision]] from the same task.
