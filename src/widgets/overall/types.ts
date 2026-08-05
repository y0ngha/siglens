import type {
    OverallAnalysisResponse,
    OverallAxis,
} from '@y0ngha/siglens-core';

export type OverallAnalysisState =
    | { status: 'idle' }
    | { status: 'submitting' }
    | { status: 'done'; result: OverallAnalysisResponse }
    | { status: 'bot_blocked' }
    | { status: 'error'; error: string; axis?: OverallAxis };
