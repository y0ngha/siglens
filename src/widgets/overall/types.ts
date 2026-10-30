import type {
    OverallAnalysisResponse,
    OverallAxis,
} from '@y0ngha/siglens-core';

/**
 * 결과를 지킨 채 덧붙이는 안내. 재분석이 쿨다운으로 거절됐거나 실패했을 때
 * 직전 분석 아래에 보여 준다. `message`는 이미 로케일에 맞는 문구다.
 */
export interface OverallAnalysisNotice {
    kind: 'cooldown' | 'failed';
    message: string;
}

export type OverallAnalysisState =
    | { status: 'idle' }
    | { status: 'submitting' }
    | {
          status: 'done';
          result: OverallAnalysisResponse;
          /** 평이화 산문. `null`이면 쉽게보기 토글을 렌더하지 않는다. */
          plain: string | null;
          /** 재분석 요청이 진행 중인지. 결과는 그대로 두고 진행만 알린다. */
          reanalyzing: boolean;
          notice: OverallAnalysisNotice | null;
      }
    | { status: 'error'; error: string; axis?: OverallAxis };
