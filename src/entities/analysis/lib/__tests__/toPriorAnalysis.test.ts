import { toPriorAnalysis } from '@/entities/analysis/lib/toPriorAnalysis';

const generatedAt = new Date('2026-09-01T00:00:00.000Z');

function project(result: unknown): ReturnType<typeof toPriorAnalysis> {
    return toPriorAnalysis({ result, generatedAt });
}

describe('toPriorAnalysis', () => {
    it('keeps trend, riskLevel and generatedAt of a well-formed row', () => {
        expect(project({ trend: 'bullish', riskLevel: 'low' })).toEqual({
            generatedAt,
            trend: 'bullish',
            riskLevel: 'low',
        });
    });

    it.each([null, undefined, 'bullish', 42])(
        'drops a row whose result is not an object (%s)',
        result => {
            expect(project(result)).toBeNull();
        }
    );

    it('drops a row without riskLevel', () => {
        expect(project({ trend: 'bullish' })).toBeNull();
    });

    it('drops a row whose trend is a string outside the union', () => {
        expect(project({ trend: 'sideways', riskLevel: 'low' })).toBeNull();
    });

    it('drops a row whose riskLevel is a string outside the union', () => {
        expect(project({ trend: 'neutral', riskLevel: 'extreme' })).toBeNull();
    });

    it('prefers reconciled stop-loss and take-profit over the raw AI values', () => {
        expect(
            project({
                trend: 'bearish',
                riskLevel: 'high',
                actionRecommendation: {
                    entryPrices: [100, 0, Number.NaN, 101],
                    stopLoss: 90,
                    takeProfitPrices: [1],
                    reconciledLevels: {
                        stopLoss: 95,
                        takeProfitPrices: [110, 120],
                    },
                },
            })
        ).toEqual({
            generatedAt,
            trend: 'bearish',
            riskLevel: 'high',
            entryPrices: [100, 101],
            stopLoss: 95,
            takeProfitPrices: [110, 120],
        });
    });

    it.each([null, 'buy', 7])(
        'ignores a non-object actionRecommendation (%s)',
        actionRecommendation => {
            expect(
                project({
                    trend: 'neutral',
                    riskLevel: 'medium',
                    actionRecommendation,
                })
            ).toEqual({ generatedAt, trend: 'neutral', riskLevel: 'medium' });
        }
    );
});
