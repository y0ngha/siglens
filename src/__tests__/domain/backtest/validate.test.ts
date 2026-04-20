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
        exitReason: 'take_profit',
        aiResult: 'win',
        aiTrendHit: true,
        aiAnalysis: {
            summary: 'RSI 반등',
            tags: ['RSI 과매도'],
            entryRecommendation: 'enter',
            bullishTargets: [{ price: 125.0, basis: '직전 저항선' }],
            stopLoss: 95.0,
            takeProfit: 125.0,
            riskLevel: 'moderate',
        },
    };

    const validData = {
        meta: {
            period: '2025.04 – 2026.04',
            totalCases: 1,
            winRate: 100,
            aiWinRate: 100,
            aiTrendHitRate: 100,
            tickerCount: 1,
        },
        cases: [validCase],
    };

    describe('valid input', () => {
        it('returns data unchanged when input is valid', () => {
            expect(validateBacktestData(validData)).toEqual(validData);
        });

        it('accepts aiResult = neutral', () => {
            const data = {
                ...validData,
                cases: [{ ...validCase, aiResult: 'neutral' }],
            };
            expect(validateBacktestData(data)).toEqual(data);
        });

        it('accepts exitReason = stop_loss', () => {
            const data = {
                ...validData,
                cases: [{ ...validCase, exitReason: 'stop_loss' }],
            };
            expect(validateBacktestData(data)).toEqual(data);
        });

        it('accepts exitReason = time', () => {
            const data = {
                ...validData,
                cases: [{ ...validCase, exitReason: 'time' }],
            };
            expect(validateBacktestData(data)).toEqual(data);
        });

        it('accepts aiTrendHit = false', () => {
            const data = {
                ...validData,
                cases: [{ ...validCase, aiTrendHit: false }],
            };
            expect(validateBacktestData(data)).toEqual(data);
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

        it('throws when meta.aiTrendHitRate is missing', () => {
            const bad = {
                ...validData,
                meta: { ...validData.meta, aiTrendHitRate: undefined },
            };
            expect(() => validateBacktestData(bad)).toThrow(
                'meta.aiTrendHitRate must be a number'
            );
        });

        it('throws when meta.aiTrendHitRate is not a number', () => {
            const bad = {
                ...validData,
                meta: { ...validData.meta, aiTrendHitRate: '100' },
            };
            expect(() => validateBacktestData(bad)).toThrow(
                'meta.aiTrendHitRate must be a number'
            );
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

        it('throws when signalType is not buy', () => {
            const bad = {
                ...validData,
                cases: [{ ...validCase, signalType: 'sell' }],
            };
            expect(() => validateBacktestData(bad)).toThrow(
                "cases[0].signalType must be 'buy'"
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

        it('throws when result is neutral (only allowed on aiResult)', () => {
            const bad = {
                ...validData,
                cases: [{ ...validCase, result: 'neutral' }],
            };
            expect(() => validateBacktestData(bad)).toThrow(
                "cases[0].result must be 'win' or 'loss'"
            );
        });

        it('throws when aiResult is not win, loss, or neutral', () => {
            const bad = {
                ...validData,
                cases: [{ ...validCase, aiResult: 'maybe' }],
            };
            expect(() => validateBacktestData(bad)).toThrow(
                "cases[0].aiResult must be 'win', 'loss', or 'neutral'"
            );
        });

        it('throws when exitReason is invalid', () => {
            const bad = {
                ...validData,
                cases: [{ ...validCase, exitReason: 'signal' }],
            };
            expect(() => validateBacktestData(bad)).toThrow(
                "cases[0].exitReason must be 'take_profit', 'stop_loss', or 'time'"
            );
        });

        it('throws when aiTrendHit is not a boolean', () => {
            const bad = {
                ...validData,
                cases: [{ ...validCase, aiTrendHit: 'yes' }],
            };
            expect(() => validateBacktestData(bad)).toThrow(
                'cases[0].aiTrendHit must be a boolean'
            );
        });

        it('throws when aiTrendHit is missing', () => {
            const bad = {
                ...validData,
                cases: [{ ...validCase, aiTrendHit: undefined }],
            };
            expect(() => validateBacktestData(bad)).toThrow(
                'cases[0].aiTrendHit must be a boolean'
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

        it('throws when aiAnalysis.entryRecommendation is missing', () => {
            const bad = {
                ...validData,
                cases: [
                    {
                        ...validCase,
                        aiAnalysis: {
                            ...validCase.aiAnalysis,
                            entryRecommendation: undefined,
                        },
                    },
                ],
            };
            expect(() => validateBacktestData(bad)).toThrow(
                "cases[0].aiAnalysis.entryRecommendation must be 'enter', 'wait', or 'avoid'"
            );
        });

        it('throws when aiAnalysis.entryRecommendation is an invalid value', () => {
            const bad = {
                ...validData,
                cases: [
                    {
                        ...validCase,
                        aiAnalysis: {
                            ...validCase.aiAnalysis,
                            entryRecommendation: 'maybe',
                        },
                    },
                ],
            };
            expect(() => validateBacktestData(bad)).toThrow(
                "cases[0].aiAnalysis.entryRecommendation must be 'enter', 'wait', or 'avoid'"
            );
        });

        it('throws when aiAnalysis.bullishTargets is missing', () => {
            const bad = {
                ...validData,
                cases: [
                    {
                        ...validCase,
                        aiAnalysis: {
                            ...validCase.aiAnalysis,
                            bullishTargets: undefined,
                        },
                    },
                ],
            };
            expect(() => validateBacktestData(bad)).toThrow(
                'cases[0].aiAnalysis.bullishTargets must be an array'
            );
        });

        it('throws when aiAnalysis.bullishTargets is not an array', () => {
            const bad = {
                ...validData,
                cases: [
                    {
                        ...validCase,
                        aiAnalysis: {
                            ...validCase.aiAnalysis,
                            bullishTargets: 'not-array',
                        },
                    },
                ],
            };
            expect(() => validateBacktestData(bad)).toThrow(
                'cases[0].aiAnalysis.bullishTargets must be an array'
            );
        });

        it('throws when aiAnalysis.bullishTargets[0].price is not a number', () => {
            const bad = {
                ...validData,
                cases: [
                    {
                        ...validCase,
                        aiAnalysis: {
                            ...validCase.aiAnalysis,
                            bullishTargets: [{ price: '125', basis: 'x' }],
                        },
                    },
                ],
            };
            expect(() => validateBacktestData(bad)).toThrow(
                'cases[0].aiAnalysis.bullishTargets[0].price must be a number'
            );
        });

        it('throws when aiAnalysis.bullishTargets[0].basis is not a string', () => {
            const bad = {
                ...validData,
                cases: [
                    {
                        ...validCase,
                        aiAnalysis: {
                            ...validCase.aiAnalysis,
                            bullishTargets: [{ price: 125, basis: 42 }],
                        },
                    },
                ],
            };
            expect(() => validateBacktestData(bad)).toThrow(
                'cases[0].aiAnalysis.bullishTargets[0].basis must be a string'
            );
        });

        it('throws when aiAnalysis.stopLoss is present but not a number', () => {
            const bad = {
                ...validData,
                cases: [
                    {
                        ...validCase,
                        aiAnalysis: {
                            ...validCase.aiAnalysis,
                            stopLoss: '95.0',
                        },
                    },
                ],
            };
            expect(() => validateBacktestData(bad)).toThrow(
                'cases[0].aiAnalysis.stopLoss must be a number when present'
            );
        });

        it('throws when aiAnalysis.takeProfit is present but not a number', () => {
            const bad = {
                ...validData,
                cases: [
                    {
                        ...validCase,
                        aiAnalysis: {
                            ...validCase.aiAnalysis,
                            takeProfit: '125.0',
                        },
                    },
                ],
            };
            expect(() => validateBacktestData(bad)).toThrow(
                'cases[0].aiAnalysis.takeProfit must be a number when present'
            );
        });

        it('throws when aiAnalysis.riskLevel is present but not a string', () => {
            const bad = {
                ...validData,
                cases: [
                    {
                        ...validCase,
                        aiAnalysis: {
                            ...validCase.aiAnalysis,
                            riskLevel: 42,
                        },
                    },
                ],
            };
            expect(() => validateBacktestData(bad)).toThrow(
                'cases[0].aiAnalysis.riskLevel must be a string when present'
            );
        });
    });

    describe('valid input (extended aiAnalysis)', () => {
        it('accepts aiAnalysis with stopLoss/takeProfit/riskLevel omitted', () => {
            const { stopLoss, takeProfit, riskLevel, ...rest } =
                validCase.aiAnalysis;
            void stopLoss;
            void takeProfit;
            void riskLevel;
            const data = {
                ...validData,
                cases: [{ ...validCase, aiAnalysis: rest }],
            };
            expect(validateBacktestData(data)).toEqual(data);
        });

        it('accepts aiAnalysis with empty bullishTargets array', () => {
            const data = {
                ...validData,
                cases: [
                    {
                        ...validCase,
                        aiAnalysis: {
                            ...validCase.aiAnalysis,
                            bullishTargets: [],
                        },
                    },
                ],
            };
            expect(validateBacktestData(data)).toEqual(data);
        });

        it('accepts entryRecommendation = avoid', () => {
            const data = {
                ...validData,
                cases: [
                    {
                        ...validCase,
                        aiAnalysis: {
                            ...validCase.aiAnalysis,
                            entryRecommendation: 'avoid',
                        },
                    },
                ],
            };
            expect(validateBacktestData(data)).toEqual(data);
        });
    });
});
