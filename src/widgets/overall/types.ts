import type {
    OverallAnalysisResponse,
    OverallAxis,
} from '@y0ngha/siglens-core';

export type OverallAnalysisState =
    | { status: 'idle' }
    | { status: 'submitting' }
    | {
          status: 'done';
          result: OverallAnalysisResponse;
          /** 평이화 산문. `null`이면 쉽게보기 토글을 렌더하지 않는다. */
          plain: string | null;
      }
    | { status: 'bot_blocked' }
    | { status: 'error'; error: string; axis?: OverallAxis };
