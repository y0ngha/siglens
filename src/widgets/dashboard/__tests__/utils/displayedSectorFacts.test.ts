import type { Signal, StockSignalResult } from '@y0ngha/siglens-core';
import { buildDisplayedSectorFacts } from '@/widgets/dashboard/utils/displayedSectorFacts';

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
        koreanName: `${symbol}-KR`,
        sectorSymbol: 'XLK',
        price: 100,
        changePercent: 1,
        trend: 'sideways',
        signals,
        ...overrides,
    };
}

function build(stocks: StockSignalResult[]) {
    return buildDisplayedSectorFacts({
        computedAt: '2026-06-04T00:00:00Z',
        stocks,
    });
}

describe('buildDisplayedSectorFacts', () => {
    it('빈 입력은 빈 배열이다', () => {
        expect(build([])).toEqual([]);
    });

    it('패널이 걷어내는 종목은 세지도 대표 종목에 넣지도 않는다', () => {
        const facts = build([
            stock('HIDDEN', [signal('bullish', 'expected')], {
                trend: 'uptrend',
            }),
            stock('SHOWN', [signal('bullish')]),
        ]);
        expect(facts).toHaveLength(1);
        expect(facts[0]?.bullishCount).toBe(1);
        expect(facts[0]?.topSymbols).toEqual(['SHOWN']);
    });

    it('전부 걷어내지면 섹터 항목도 사라진다', () => {
        expect(
            build([
                stock('HIDDEN', [signal('bearish', 'expected')], {
                    trend: 'downtrend',
                }),
            ])
        ).toEqual([]);
    });

    it('상충 신호는 우세한 방향 쪽으로만 센다', () => {
        const [fact] = build([
            stock('WIN', [
                signal('bullish'),
                signal('bullish'),
                signal('bearish'),
            ]),
        ]);
        expect(fact?.bullishCount).toBe(1);
        expect(fact?.bearishCount).toBe(0);
    });

    it('방향이 팽팽한 혼재 종목은 양쪽에 센다', () => {
        const [fact] = build([
            stock('TIE', [signal('bullish'), signal('bearish')]),
        ]);
        expect(fact?.bullishCount).toBe(1);
        expect(fact?.bearishCount).toBe(1);
    });

    it('섹터별로 묶고 섹터 심볼 순으로 정렬한다', () => {
        const facts = build([
            stock('B', [signal('bullish')], { sectorSymbol: 'XLK' }),
            stock('A', [signal('bullish')], { sectorSymbol: 'XLF' }),
        ]);
        expect(facts.map(f => f.sectorSymbol)).toEqual(['XLF', 'XLK']);
    });
});
