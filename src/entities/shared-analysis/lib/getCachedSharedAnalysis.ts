import { cache } from 'react';
import { getSharedAnalysisAction } from '../actions/getSharedAnalysisAction';

/**
 * Request-scoped memoisation of `getSharedAnalysisAction`.
 *
 * React `cache` deduplicates calls with the same `id` within a single RSC
 * render pass, eliminating the redundant DB round-trips that occur when
 * `generateMetadata`, the page body, and `opengraph-image` each call the
 * action independently for the same `/share/[id]` request.
 *
 * This wrapper is intentionally thin: it holds no state and introduces no
 * additional logic so that `getSharedAnalysisAction` remains the single
 * source of truth for lookup semantics (not_found / expired / found).
 */
export const getCachedSharedAnalysis = cache(getSharedAnalysisAction);
