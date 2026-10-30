import { isEmptyOptionsAnalysis } from '@/widgets/options/utils/isEmptyOptionsAnalysis';
import type { OptionsAnalysisResponse } from '@y0ngha/siglens-core';

const EMPTY: OptionsAnalysisResponse = {
    summary: '',
    perExpiration: [],
    signals: [],
    analyzedAt: '2025-01-15T10:00:00Z',
};

describe('isEmptyOptionsAnalysis', () => {
    it('is true when summary, commentary and signals are all empty', () => {
        expect(isEmptyOptionsAnalysis(EMPTY)).toBe(true);
    });

    it('is false with a summary', () => {
        expect(isEmptyOptionsAnalysis({ ...EMPTY, summary: 'x' })).toBe(false);
    });

    it('is false with per-expiration commentary', () => {
        expect(
            isEmptyOptionsAnalysis({
                ...EMPTY,
                perExpiration: [
                    {
                        expirationDate: '2025-06-20',
                        tone: 'neutral',
                        commentary: 'c',
                    },
                ],
            })
        ).toBe(false);
    });

    it('is false with signals', () => {
        expect(
            isEmptyOptionsAnalysis({
                ...EMPTY,
                signals: [{ kind: 'bullish', message: 'm' }],
            })
        ).toBe(false);
    });
});
