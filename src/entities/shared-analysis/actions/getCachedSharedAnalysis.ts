import { cache } from 'react';
import { getSharedAnalysisAction } from './getSharedAnalysisAction';

/**
 * Request-scoped memoisation of `getSharedAnalysisAction`.
 *
 * React `cache` deduplicates calls with the same `id` within a single RSC
 * render pass, eliminating the redundant DB round-trips that occur when
 * `generateMetadata` and the page body each call the action independently
 * for the same `/share/[id]` request.
 *
 * Scope: dedup covers only the current HTTP request's render pass
 * (`generateMetadata` + page body). The `/share/[id]/opengraph-image` route
 * is a separate HTTP request with its own render pass and is NOT covered by
 * this cache wrapper.
 *
 * This wrapper is intentionally thin: it holds no state and introduces no
 * additional logic so that `getSharedAnalysisAction` remains the single
 * source of truth for lookup semantics (not_found / expired / found).
 *
 * Placed in `actions/` rather than `lib/` because it wraps a Server Action
 * (`getSharedAnalysisAction`) and participates in the server request lifecycle;
 * `lib/` is reserved for pure, environment-agnostic functions.
 */
export const getCachedSharedAnalysis = cache(getSharedAnalysisAction);
