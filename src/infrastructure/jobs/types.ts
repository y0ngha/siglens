import type { Timeframe } from '@/domain/types';

export type JobStatus = 'processing' | 'done' | 'error';

export interface JobMeta {
    symbol: string;
    timeframe: Timeframe;
    skillsDegraded: boolean;
}
