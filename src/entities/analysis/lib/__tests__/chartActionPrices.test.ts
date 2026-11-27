import type { ActionRecommendation } from '@y0ngha/siglens-core';
import { describe, expect, it } from 'vitest';

import { validateChartActionPrices } from '@/entities/analysis/lib/chartActionPrices';

const rec = (over: Partial<ActionRecommendation>): ActionRecommendation =>
    ({
        positionAnalysis: '',
        entry: '',
        exit: '',
        riskReward: '',
        ...over,
    }) as ActionRecommendation;

describe('validateChartActionPrices', () => {
    it('표식이 없으면 원본 손절선을 그대로 둔다', () => {
        expect(
            validateChartActionPrices(
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
            validateChartActionPrices(
                rec({
                    entryPrices: [150],
                    stopLoss: 120,
                    takeProfitPrices: [165],
                    reconciledLevels: {
                        exit: '',
                        riskReward: '',
                        reason: '',
                        stopLossRejected: true,
                    },
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
            validateChartActionPrices(
                rec({
                    stopLoss: 120,
                    reconciledLevels: {
                        exit: '',
                        riskReward: '',
                        reason: '',
                        stopLossRejected: true,
                    },
                })
            )
        ).toBeUndefined();
    });

    it('추천이 없으면 undefined', () => {
        expect(validateChartActionPrices(undefined)).toBeUndefined();
    });
});
