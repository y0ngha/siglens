import { isPopularSymbol } from '@/entities/ticker/lib/searchRelevance';
import { dashboardScopeOf } from '@/shared/config/dashboardScope';
import { isFollowedHubSymbol } from '../isFollowedHubSymbol';

describe('isFollowedHubSymbol', () => {
    it('인기 종목은 따라간다', () => {
        expect(isPopularSymbol('NVDA')).toBe(true);
        expect(isFollowedHubSymbol('NVDA')).toBe(true);
    });

    it('한국 대시보드 목록의 모든 종목을 따라간다', () => {
        const symbols = dashboardScopeOf('kr').sectorStocks.map(
            stock => stock.symbol
        );

        expect(symbols.length).toBeGreaterThan(0);
        expect(symbols.filter(symbol => !isFollowedHubSymbol(symbol))).toEqual(
            []
        );
    });

    it('인기 목록에도 한국 대시보드 목록에도 없는 종목은 따라가지 않는다', () => {
        expect(isFollowedHubSymbol('ZZZZ')).toBe(false);
        expect(isFollowedHubSymbol('999999.KQ')).toBe(false);
    });
});
