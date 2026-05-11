import type {
    OverallAnalysisResponse,
    OverallAxis,
} from '@y0ngha/siglens-core';

export type ProgressState =
    | { phase: 'submitting' }
    | {
          phase: 'pending_dependencies';
          pendingJobs: Record<OverallAxis, string | undefined>;
          retryCount: number;
      }
    | { phase: 'polling' };

export type OverallAnalysisState =
    | { status: 'idle' }
    | {
          status: 'pending_dependencies';
          pendingJobs: Record<OverallAxis, string | undefined>;
          // 0 = 첫 진입, 1+ = polling 횟수. ETA 표시(`약 N초 남음`)에 사용.
          retryCount: number;
      }
    | { status: 'submitting' | 'polling' }
    | { status: 'done'; result: OverallAnalysisResponse }
    | { status: 'bot_blocked' }
    | { status: 'error'; error: string; axis?: OverallAxis };
