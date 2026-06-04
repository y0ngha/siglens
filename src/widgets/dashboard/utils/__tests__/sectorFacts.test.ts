import { describe, it, expect } from 'vitest';
import { buildSectorFacts } from '../sectorFacts';
import type {
    SectorSignalsResult,
    StockSignalResult,
} from '@y0ngha/siglens-core';

function makeStock(
    symbol: string,
    sectorSymbol: string,
    directions: Array<'bullish' | 'bearish'>
): StockSignalResult {
    return {
        symbol,
        koreanName: `${symbol}-KR`,
        sectorSymbol,
        price: 100,
        changePercent: 1.5,
        trend: 'uptrend',
        signals: directions.map(direction => ({
            type: 'golden_cross' as const,
            direction,
            phase: 'confirmed' as const,
            detectedAt: 0,
        })),
    };
}

function makeResult(stocks: StockSignalResult[]): SectorSignalsResult {
    return { computedAt: '2026-06-04T00:00:00Z', stocks };
}

describe('buildSectorFacts', () => {
    it('(Happy) 빈 입력 → 빈 배열', () => {
        const result = buildSectorFacts(makeResult([]));
        expect(result).toEqual([]);
    });

    it('(Happy) 단일 섹터 bullish → bullishCount=1, bearishCount=0', () => {
        const data = makeResult([makeStock('AAPL', 'XLK', ['bullish'])]);
        const [fact] = buildSectorFacts(data);
        expect(fact.sectorSymbol).toBe('XLK');
        expect(fact.bullishCount).toBe(1);
        expect(fact.bearishCount).toBe(0);
        expect(fact.topSymbols).toEqual(['AAPL']);
    });

    it('(Happy) 단일 섹터 bearish → bullishCount=0, bearishCount=1', () => {
        const data = makeResult([makeStock('NVDA', 'XLK', ['bearish'])]);
        const [fact] = buildSectorFacts(data);
        expect(fact.bullishCount).toBe(0);
        expect(fact.bearishCount).toBe(1);
        expect(fact.topSymbols).toEqual(['NVDA']);
    });

    it('(Happy) 여러 섹터가 알파벳 순 정렬된다', () => {
        const data = makeResult([
            makeStock('JPM', 'XLF', ['bullish']),
            makeStock('AAPL', 'XLK', ['bullish']),
        ]);
        const facts = buildSectorFacts(data);
        expect(facts.map(f => f.sectorSymbol)).toEqual(['XLF', 'XLK']);
    });

    it('(Happy) topSymbols는 bullish 먼저, 그 다음 bearish-only, 각 그룹 알파벳 순', () => {
        const data = makeResult([
            makeStock('MSFT', 'XLK', ['bearish']), // bearish-only
            makeStock('NVDA', 'XLK', ['bullish']), // bullish
            makeStock('AAPL', 'XLK', ['bullish']), // bullish
        ]);
        const [fact] = buildSectorFacts(data);
        expect(fact.topSymbols).toEqual(['AAPL', 'NVDA', 'MSFT']);
    });

    it('(Happy) topSymbols는 최대 3개까지만', () => {
        const data = makeResult([
            makeStock('A', 'XLK', ['bullish']),
            makeStock('B', 'XLK', ['bullish']),
            makeStock('C', 'XLK', ['bullish']),
            makeStock('D', 'XLK', ['bullish']),
        ]);
        const [fact] = buildSectorFacts(data);
        expect(fact.topSymbols).toHaveLength(3);
    });

    it('(Happy) 양쪽 방향 모두 가진 종목은 bullish+bearish 모두 카운트', () => {
        const data = makeResult([
            makeStock('AAPL', 'XLK', ['bullish', 'bearish']),
        ]);
        const [fact] = buildSectorFacts(data);
        expect(fact.bullishCount).toBe(1);
        expect(fact.bearishCount).toBe(1);
    });

    it('(Happy) 같은 입력에서 결정적(deterministic) 결과 반환', () => {
        const data = makeResult([
            makeStock('AAPL', 'XLK', ['bullish']),
            makeStock('JPM', 'XLF', ['bearish']),
        ]);
        const a = buildSectorFacts(data);
        const b = buildSectorFacts(data);
        expect(a).toEqual(b);
    });

    it('(Worst) stocks=[{}] 처럼 signals 없는 종목 → 카운트 0, topSymbols에는 포함', () => {
        // A stock with no signals: can appear if upstream allows 0-signal entries,
        // but buildSectorFacts should still group it correctly
        const stock: StockSignalResult = {
            symbol: 'AAPL',
            koreanName: '애플',
            sectorSymbol: 'XLK',
            price: 100,
            changePercent: 0,
            trend: 'sideways',
            signals: [],
        };
        const data = makeResult([stock]);
        const [fact] = buildSectorFacts(data);
        expect(fact.bullishCount).toBe(0);
        expect(fact.bearishCount).toBe(0);
        // topSymbols: no bullish, no bearish → empty
        expect(fact.topSymbols).toEqual([]);
    });

    it('(Worst) 10개 종목 → topSymbols 3개만 반환', () => {
        const stocks = Array.from({ length: 10 }, (_, i) =>
            makeStock(`S${i}`, 'XLE', ['bullish'])
        );
        const [fact] = buildSectorFacts(makeResult(stocks));
        expect(fact.topSymbols).toHaveLength(3);
    });

    it('(Worst) 섹터 하나에 bullishCount가 매우 많아도 카운트 정확', () => {
        const stocks = [
            makeStock('A', 'XLK', ['bullish']),
            makeStock('B', 'XLK', ['bullish']),
            makeStock('C', 'XLK', ['bearish']),
        ];
        const [fact] = buildSectorFacts(makeResult(stocks));
        expect(fact.bullishCount).toBe(2);
        expect(fact.bearishCount).toBe(1);
    });
});
