import type { Signal, StockSignalResult } from '@y0ngha/siglens-core';
import {
    buildSectorSignalView,
    countSubsectionStocks,
    isSectorViewEmpty,
    listDisplayedStocks,
    resolveDisplayedStocks,
    type SectorSignalView,
} from '@/widgets/dashboard/utils/sectorSignalStocks';

function signal(
    direction: Signal['direction'],
    phase: Signal['phase'] = 'confirmed'
): Signal {
    return { type: 'golden_cross', direction, phase, detectedAt: 0 };
}

function stock(
    symbol: string,
    signals: Signal[],
    overrides: Partial<StockSignalResult> = {}
): StockSignalResult {
    return {
        symbol,
        koreanName: symbol,
        sectorSymbol: 'XLK',
        price: 100,
        changePercent: 1,
        trend: 'sideways',
        signals,
        ...overrides,
    };
}

function symbols(stocks: readonly StockSignalResult[]): string[] {
    return stocks.map(s => s.symbol);
}

describe('resolveDisplayedStocks', () => {
    it('추세와 같은 방향의 예상 신호만 가진 종목은 걷어낸다', () => {
        const { resolved, mixed } = resolveDisplayedStocks([
            stock('UP', [signal('bullish', 'expected')], { trend: 'uptrend' }),
            stock('DOWN', [signal('bearish', 'expected')], {
                trend: 'downtrend',
            }),
        ]);
        expect([...resolved, ...mixed]).toEqual([]);
    });

    it('추세와 어긋난 예상 신호는 남긴다', () => {
        const { resolved } = resolveDisplayedStocks([
            stock('REVERSAL', [signal('bullish', 'expected')], {
                trend: 'downtrend',
            }),
        ]);
        expect(symbols(resolved)).toEqual(['REVERSAL']);
    });

    it('확정 신호는 추세와 무관하게 남긴다', () => {
        const { resolved } = resolveDisplayedStocks([
            stock('CONFIRMED', [signal('bullish')], { trend: 'uptrend' }),
        ]);
        expect(symbols(resolved)).toEqual(['CONFIRMED']);
    });

    it('방향이 우세한 상충 종목은 우세한 신호만 남기고 충돌 정보를 붙인다', () => {
        const { resolved } = resolveDisplayedStocks([
            stock('WIN', [
                signal('bullish'),
                signal('bullish'),
                signal('bearish'),
            ]),
        ]);
        expect(resolved[0]?.signals.map(s => s.direction)).toEqual([
            'bullish',
            'bullish',
        ]);
        expect(resolved[0]?.conflict).toEqual({
            bullishCount: 2,
            bearishCount: 1,
        });
    });

    it('방향이 팽팽한 종목은 혼재로 분류한다', () => {
        const { resolved, mixed } = resolveDisplayedStocks([
            stock('TIE', [signal('bullish'), signal('bearish')]),
        ]);
        expect(resolved).toEqual([]);
        expect(symbols(mixed)).toEqual(['TIE']);
    });
});

describe('listDisplayedStocks', () => {
    it('정리된 종목과 혼재 종목을 모두 돌려준다', () => {
        const displayed = listDisplayedStocks([
            stock('A', [signal('bullish')]),
            stock('B', [signal('bullish'), signal('bearish')]),
            stock('C', [signal('bullish', 'expected')], { trend: 'uptrend' }),
        ]);
        expect(symbols(displayed).toSorted()).toEqual(['A', 'B']);
    });
});

describe('buildSectorSignalView', () => {
    const STOCKS = [
        stock('XLK_CONFIRMED', [signal('bullish')]),
        stock('XLK_BEAR', [signal('bearish')]),
        stock('XLK_TIE', [signal('bullish'), signal('bearish')]),
        stock('XLF_CONFIRMED', [signal('bullish')], { sectorSymbol: 'XLF' }),
    ];

    it('선택한 섹터의 종목만 사분면에 담는다', () => {
        const view = buildSectorSignalView(STOCKS, 'XLK');
        expect(symbols(view.quadrants.bullishConfirmed)).toEqual([
            'XLK_CONFIRMED',
        ]);
        expect(symbols(view.quadrants.bearishConfirmed)).toEqual(['XLK_BEAR']);
    });

    it('혼재 종목은 mixedStocks에 담는다', () => {
        expect(
            symbols(buildSectorSignalView(STOCKS, 'XLK').mixedStocks)
        ).toEqual(['XLK_TIE']);
    });

    it('신호가 없는 섹터는 모든 구획이 빈 화면 구성이다', () => {
        const view = buildSectorSignalView(STOCKS, 'XLE');
        expect(isSectorViewEmpty(view)).toBe(true);
    });

    it('확정/예상 신호를 사분면으로 나눈다', () => {
        const view = buildSectorSignalView(
            [
                stock('EXPECTED', [signal('bearish', 'expected')], {
                    trend: 'uptrend',
                }),
            ],
            'XLK'
        );
        expect(symbols(view.quadrants.bearishExpected)).toEqual(['EXPECTED']);
    });
});

describe('isSectorViewEmpty', () => {
    const EMPTY: SectorSignalView = {
        quadrants: {
            bullishConfirmed: [],
            bullishExpected: [],
            bearishExpected: [],
            bearishConfirmed: [],
        },
        mixedStocks: [],
    };
    const ONE = [{ ...stock('A', []), conflict: undefined }];

    it('모든 구획이 비면 true다', () => {
        expect(isSectorViewEmpty(EMPTY)).toBe(true);
    });

    it('사분면 하나라도 차 있으면 false다', () => {
        expect(
            isSectorViewEmpty({
                ...EMPTY,
                quadrants: { ...EMPTY.quadrants, bearishExpected: ONE },
            })
        ).toBe(false);
    });

    it('혼재 구획에만 종목이 있어도 false다', () => {
        expect(isSectorViewEmpty({ ...EMPTY, mixedStocks: ONE })).toBe(false);
    });
});

describe('countSubsectionStocks', () => {
    it('다섯 소절의 종목 수를 각각 센다', () => {
        const one = [{ ...stock('A', []) }];
        const two = [{ ...stock('B', []) }, { ...stock('C', []) }];
        expect(
            countSubsectionStocks({
                quadrants: {
                    bullishConfirmed: two,
                    bullishExpected: one,
                    bearishExpected: [],
                    bearishConfirmed: [...two, ...one],
                },
                mixedStocks: one,
            })
        ).toEqual({
            bullishConfirmed: 2,
            bullishExpected: 1,
            mixed: 1,
            bearishExpected: 0,
            bearishConfirmed: 3,
        });
    });
});
