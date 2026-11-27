import { validateActionPrices } from '@y0ngha/siglens-core';
import type { ActionRecommendation } from '@y0ngha/siglens-core';
import { describe, expect, it } from 'vitest';

/**
 * 차트 진입·손절·익절선은 core `validateActionPrices`를 그대로 쓴다. core 3.1.0부터 손절 거부 표식
 * (`reconciledLevels.stopLossRejected`)을 core가 처리하므로, 예전 siglens 보정 함수가 지키던 동작을 여기서 고정한다.
 */
const rec = (over: Partial<ActionRecommendation>): ActionRecommendation =>
    ({
        positionAnalysis: '',
        entry: '',
        exit: '',
        riskReward: '',
        ...over,
    }) as ActionRecommendation;

const rejected = {
    exit: '',
    riskReward: '',
    reason: '',
    stopLossRejected: true,
} as const;

describe('validateActionPrices (core): 손절 거부 표식', () => {
    it('표식이 없으면 원본 손절선을 그대로 둔다', () => {
        expect(
            validateActionPrices(
                rec({
                    entryPrices: [150],
                    stopLoss: 140,
                    takeProfitPrices: [165],
                })
            )
        ).toEqual({
            entryPrices: [150],
            stopLoss: 140,
            takeProfitPrices: [165],
        });
    });

    it('손절 거부 표식이 있으면 거부된 원본 손절선을 뺀다', () => {
        expect(
            validateActionPrices(
                rec({
                    entryPrices: [150],
                    stopLoss: 120,
                    takeProfitPrices: [165],
                    reconciledLevels: rejected,
                })
            )
        ).toEqual({
            entryPrices: [150],
            stopLoss: undefined,
            takeProfitPrices: [165],
        });
    });

    it('손절만 있던 계획이 거부되면 그릴 것이 없다', () => {
        expect(
            validateActionPrices(
                rec({ stopLoss: 120, reconciledLevels: rejected })
            )
        ).toBeUndefined();
    });

    it('추천이 없으면 undefined', () => {
        expect(validateActionPrices(undefined)).toBeUndefined();
    });
});
