/**
 * ponytail: @y0ngha/siglens-core#runAnalysis is not yet published.
 *
 * This bridge exists so the route can be tested independently of the core import —
 * tests mock `'../runAnalysisBridge'` rather than the entire `@y0ngha/siglens-core`
 * package (which would clobber every other core export).
 *
 * Replace the `null` stub below with a real re-export once core ships runAnalysis:
 *
 * ```ts
 * export { runAnalysis } from '@y0ngha/siglens-core';
 * ```
 *
 * The `RunAnalysisResult` and `RunAnalysisOptions` types below reflect the
 * intended core signature (mirrors `SubmitAnalysisGatedResult` but `'submitted'`
 * becomes `'done'` — no Redis submit/poll loop in the SSE-native path).
 */

import type { SubmitAnalysisOptions, Timeframe } from '@y0ngha/siglens-core';

export type RunAnalysisResult =
    | {
          status: 'cached' | 'done';
          result: unknown;
          lockedInfoDepth: readonly unknown[];
      }
    | { status: 'miss_no_trigger' }
    | { status: 'error'; error: unknown };

export type RunAnalysisOptions = SubmitAnalysisOptions & {
    /**
     * Propagated from `request.signal`. When the client disconnects mid-stream,
     * aborting here cancels the in-flight LLM call in core.
     */
    signal?: AbortSignal;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const runAnalysis = null as any as (
    symbol: string,
    companyName: string,
    timeframe: Timeframe,
    force?: boolean,
    fmpSymbol?: string,
    options?: RunAnalysisOptions
) => Promise<RunAnalysisResult>;
