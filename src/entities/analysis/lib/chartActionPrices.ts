import {
    type ActionRecommendation,
    type ValidatedActionPrices,
    validateActionPrices,
} from '@y0ngha/siglens-core';
import { isStopLossRejected } from './effectiveActionLevels';

/**
 * 차트 진입·손절·익절선에 쓸 검증된 가격. core `validateActionPrices`에 손절 거부 표식을 더한다.
 *
 * core `validateActionPrices`는 원본 `stopLoss`만 본다. core가 모델 손절을 거부한 계획
 * (`reconciledLevels.stopLossRejected`)은 손절이 없는 계획이므로, 거부된 값으로 차트
 * 손절선을 긋지 않도록 여기서 뺀다. 보정 손절선은 core가 `reconciledLevels.stopLoss`를
 * 비워 두므로 `extractReconciledActionLines`에서 원래 나오지 않는다.
 */
export function validateChartActionPrices(
    rec: ActionRecommendation | undefined
): ValidatedActionPrices | undefined {
    const validated = validateActionPrices(rec);
    if (validated === undefined || !isStopLossRejected(rec)) return validated;
    // 손절만 있던 계획이면 남는 선이 없다 — core와 같이 `undefined`로 "그릴 것 없음"을 알린다.
    return validated.entryPrices.length === 0 &&
        validated.takeProfitPrices.length === 0
        ? undefined
        : { ...validated, stopLoss: undefined };
}
