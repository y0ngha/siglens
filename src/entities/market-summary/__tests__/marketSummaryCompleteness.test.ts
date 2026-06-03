import type { MarketSummaryData } from '@y0ngha/siglens-core';
import {
    allQuotesPresent,
    hasMissingQuotes,
} from '../lib/marketSummaryCompleteness';

function makeSummary(
    indexPrices: number[],
    sectorPrices: number[]
): MarketSummaryData {
    return {
        indices: indexPrices.map((price, i) => ({
            symbol: `IDX${i}`,
            fmpSymbol: `^IDX${i}`,
            displayName: `Index ${i}`,
            koreanName: `지수 ${i}`,
            price,
            changesPercentage: price === 0 ? 0 : 1,
        })),
        sectors: sectorPrices.map((price, i) => ({
            symbol: `XL${i}`,
            sectorName: `Sector ${i}`,
            koreanName: `섹터 ${i}`,
            price,
            changesPercentage: price === 0 ? 0 : 1,
        })),
    };
}

describe('marketSummaryCompleteness', () => {
    describe('hasMissingQuotes', () => {
        it('전 종목이 비-0 시세면 false', () => {
            const summary = makeSummary([5000, 39000], [200, 80]);
            expect(hasMissingQuotes(summary)).toBe(false);
        });

        it('지수 중 하나라도 0이면 true', () => {
            const summary = makeSummary([5000, 0], [200, 80]);
            expect(hasMissingQuotes(summary)).toBe(true);
        });

        it('섹터 중 하나라도 0이면 true', () => {
            const summary = makeSummary([5000, 39000], [200, 0]);
            expect(hasMissingQuotes(summary)).toBe(true);
        });

        it('전 종목이 0이면(전면 장애) true', () => {
            const summary = makeSummary([0, 0], [0, 0]);
            expect(hasMissingQuotes(summary)).toBe(true);
        });

        it('지수/섹터 배열이 비어 있으면 false (검사할 대상 없음)', () => {
            const summary = makeSummary([], []);
            expect(hasMissingQuotes(summary)).toBe(false);
        });
    });

    describe('allQuotesPresent', () => {
        it('hasMissingQuotes의 정확한 역', () => {
            const complete = makeSummary([5000], [200]);
            const partial = makeSummary([5000], [0]);
            const total = makeSummary([0], [0]);

            expect(allQuotesPresent(complete)).toBe(true);
            expect(allQuotesPresent(partial)).toBe(false);
            expect(allQuotesPresent(total)).toBe(false);

            for (const s of [complete, partial, total]) {
                expect(allQuotesPresent(s)).toBe(!hasMissingQuotes(s));
            }
        });
    });
});
