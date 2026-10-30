import type { MarketSummaryData } from '@y0ngha/siglens-core';
import {
    KR_DASHBOARD_SCOPE,
    US_DASHBOARD_SCOPE,
} from '@/shared/config/dashboardScope';
import { shouldCacheMarketSummary } from '../lib/shouldCacheMarketSummary';

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
            changesPercentage: 1,
        })),
        sectors: sectorPrices.map((price, i) => ({
            symbol: `XL${i}`,
            sectorName: `Sector ${i}`,
            koreanName: `섹터 ${i}`,
            price,
            changesPercentage: 1,
        })),
    };
}

describe('shouldCacheMarketSummary', () => {
    describe('미국 scope일 때', () => {
        it('지수·섹터가 모두 있으면 캐시한다', () => {
            expect(
                shouldCacheMarketSummary(
                    US_DASHBOARD_SCOPE,
                    makeSummary([1], [1])
                )
            ).toBe(true);
        });

        it('섹터 하나만 비어도 캐시하지 않는다', () => {
            expect(
                shouldCacheMarketSummary(
                    US_DASHBOARD_SCOPE,
                    makeSummary([1], [1, 0])
                )
            ).toBe(false);
        });
    });

    describe('한국 scope일 때', () => {
        it('섹터가 비어도 지수가 모두 있으면 캐시한다', () => {
            expect(
                shouldCacheMarketSummary(
                    KR_DASHBOARD_SCOPE,
                    makeSummary([1, 2], [0, 1])
                )
            ).toBe(true);
        });

        it('지수 하나라도 비면 캐시하지 않는다', () => {
            expect(
                shouldCacheMarketSummary(
                    KR_DASHBOARD_SCOPE,
                    makeSummary([1, 0], [1])
                )
            ).toBe(false);
        });

        it('지수가 하나도 없으면 캐시하지 않는다', () => {
            expect(
                shouldCacheMarketSummary(
                    KR_DASHBOARD_SCOPE,
                    makeSummary([], [1])
                )
            ).toBe(false);
        });
    });
});
