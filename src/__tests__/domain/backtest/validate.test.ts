import { validateBacktestData } from '@/domain/backtest/validate';

describe('validateBacktestData', () => {
    const validCase = {
        ticker: 'NVDA',
        entryDate: '2025-04-11',
        entryPrice: 98.31,
        exitDate: '2025-04-19',
        exitPrice: 121.42,
        holdingDays: 8,
        returnPct: 23.5,
        signalType: 'buy',
        result: 'win',
        exitReason: 'signal',
        aiResult: 'win',
        aiAnalysis: { summary: 'RSI 반등', tags: ['RSI 과매도'] },
    };

    const validData = {
        meta: {
            period: '2025.04 – 2026.04',
            totalCases: 1,
            winRate: 100,
            aiWinRate: 100,
            tickerCount: 1,
        },
        cases: [validCase],
    };

    describe('valid input', () => {
        it('returns data unchanged when input is valid', () => {
            expect(validateBacktestData(validData)).toEqual(validData);
        });
    });

    describe('invalid input', () => {
        it('throws when data is null', () => {
            expect(() => validateBacktestData(null)).toThrow(
                'BacktestData must be an object'
            );
        });

        it('throws when data is not an object', () => {
            expect(() => validateBacktestData('string')).toThrow(
                'BacktestData must be an object'
            );
        });

        it('throws when meta is missing', () => {
            expect(() => validateBacktestData({ cases: [] })).toThrow(
                'meta must be an object'
            );
        });

        it('throws when meta is null', () => {
            expect(() =>
                validateBacktestData({ meta: null, cases: [] })
            ).toThrow('meta must be an object');
        });

        it('throws when cases is not an array', () => {
            expect(() =>
                validateBacktestData({ ...validData, cases: null })
            ).toThrow('cases must be an array');
        });

        it('throws when a case has invalid returnPct type', () => {
            const bad = {
                ...validData,
                cases: [{ ...validCase, returnPct: '23.5' }],
            };
            expect(() => validateBacktestData(bad)).toThrow(
                'cases[0].returnPct must be a number'
            );
        });

        it('throws when result is not win or loss', () => {
            const bad = {
                ...validData,
                cases: [{ ...validCase, result: 'maybe' }],
            };
            expect(() => validateBacktestData(bad)).toThrow(
                "cases[0].result must be 'win' or 'loss'"
            );
        });

        it('throws when aiAnalysis.tags is not an array', () => {
            const bad = {
                ...validData,
                cases: [
                    { ...validCase, aiAnalysis: { summary: 'x', tags: 'x' } },
                ],
            };
            expect(() => validateBacktestData(bad)).toThrow(
                'cases[0].aiAnalysis.tags must be an array'
            );
        });

        it('throws when aiAnalysis is null', () => {
            const bad = {
                ...validData,
                cases: [{ ...validCase, aiAnalysis: null }],
            };
            expect(() => validateBacktestData(bad)).toThrow(
                'cases[0].aiAnalysis.tags must be an array'
            );
        });

        it('throws when aiAnalysis is not an object', () => {
            const bad = {
                ...validData,
                cases: [{ ...validCase, aiAnalysis: 42 }],
            };
            expect(() => validateBacktestData(bad)).toThrow(
                'cases[0].aiAnalysis.tags must be an array'
            );
        });
    });
});
