import type { MarketSummaryData } from '@y0ngha/siglens-core';
import {
    E2E_FORCE_MARKET_PARTIAL_COOKIE,
    e2eForceMarketPartial,
} from '@/shared/api/e2eMarketStub';

const summary: MarketSummaryData = {
    indices: [
        {
            symbol: 'GSPC',
            fmpSymbol: '^GSPC',
            displayName: 'S&P 500',
            koreanName: '미국 대형주 500',
            price: 5000,
            changesPercentage: 1,
        },
    ],
    sectors: [
        {
            symbol: 'XLK',
            sectorName: 'Technology',
            koreanName: '기술',
            price: 200,
            changesPercentage: 2,
        },
        {
            symbol: 'XLF',
            sectorName: 'Financials',
            koreanName: '금융',
            price: 40,
            changesPercentage: 0.5,
        },
    ],
};

describe('e2eMarketStub', () => {
    it('쿠키 상수가 고정 문자열이다', () => {
        expect(E2E_FORCE_MARKET_PARTIAL_COOKIE).toBe(
            'e2e_force_market_partial'
        );
    });

    it('첫 섹터만 0으로 강제하고 나머지 섹터·지수는 보존한다', () => {
        const out = e2eForceMarketPartial(summary);

        expect(out.indices).toEqual(summary.indices);
        expect(out.sectors[0]).toMatchObject({
            symbol: 'XLK',
            price: 0,
            changesPercentage: 0,
        });
        // 첫 섹터가 아닌 항목은 그대로 통과한다(map의 else 분기).
        expect(out.sectors[1]).toEqual(summary.sectors[1]);
    });

    it('입력을 변형하지 않는다(불변)', () => {
        e2eForceMarketPartial(summary);
        expect(summary.sectors[0].price).toBe(200);
    });
});
