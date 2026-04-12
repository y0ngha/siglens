import type { AnalysisResponse, Timeframe } from '@/domain/types';

export type JobStatus = 'processing' | 'done' | 'error';

export interface JobMeta {
    symbol: string;
    timeframe: Timeframe;
}

/** submitAnalysisAction 반환 타입 */
export type SubmitAnalysisResult =
    | { status: 'cached'; result: AnalysisResponse; skillsDegraded: boolean }
    | { status: 'submitted'; jobId: string };

/** pollAnalysisAction 반환 타입 */
export type PollAnalysisResult =
    | { status: 'processing' }
    | { status: 'done'; result: AnalysisResponse; skillsDegraded: boolean }
    | { status: 'error'; error: string };
