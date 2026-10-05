import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('@/widgets/market-fear-greed/MarketFearGreedPage', () => ({
    MarketFearGreedPage: () => null,
}));

const { mockLoadNames, mockShortenDb } = vi.hoisted(() => ({
    mockLoadNames: vi.fn(),
    mockShortenDb: vi.fn(async () => undefined),
}));
vi.mock('@/entities/ticker/lib/loadSymbolNames', () => ({
    loadSymbolNames: mockLoadNames,
}));
vi.mock('@/shared/cache/buildDegradedRevalidate', () => ({
    shortenRevalidateIfFmpFailedAtBuild: vi.fn(async () => undefined),
    shortenRevalidateIfDatabaseMissingAtBuild: mockShortenDb,
}));

import { FearGreedRouteBody } from '@/app/[locale]/fear-greed/FearGreedRouteBody';
import { loadFearGreedSymbolLinks } from '@/app/[locale]/fear-greed/fearGreedRoute';
import type {
    MarketFearGreedView,
    MarketFearGreedViewSnapshot,
} from '@/entities/market-fear-greed/model';
import { POPULAR_TICKERS } from '@/shared/config/popular-tickers';
import { POPULAR_CRYPTOS } from '@/shared/config/popular-cryptos';
import { isKrEquitySymbol } from '@/shared/config/marketProfile/registry';

const EMPTY_VIEW: MarketFearGreedView<MarketFearGreedViewSnapshot> = {
    snapshot: null,
    comparisons: [],
};

describe('허브의 "종목별 공포·탐욕 지수" 목록', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockLoadNames.mockResolvedValue(
            new Map([
                ['AAPL', '애플'],
                ['005930.KS', '삼성전자'],
                ['BTCUSD', '비트코인'],
            ])
        );
    });

    describe('loadFearGreedSymbolLinks', () => {
        it('미국은 비-KR 인기 종목 전부를 낸다', async () => {
            const links = await loadFearGreedSymbolLinks('us', 'ko');
            const expected = POPULAR_TICKERS.filter(t => !isKrEquitySymbol(t));
            expect(links.map(l => l.symbol).sort()).toEqual(
                [...expected].sort()
            );
            expect(links.find(l => l.symbol === 'AAPL')?.label).toBe(
                '애플 (AAPL)'
            );
        });

        it('한국은 KR 인기 종목만, 크립토는 인기 크립토만 낸다', async () => {
            const kr = await loadFearGreedSymbolLinks('kr', 'ko');
            expect(kr.map(l => l.symbol).sort()).toEqual(
                POPULAR_TICKERS.filter(isKrEquitySymbol).sort()
            );
            expect(kr.find(l => l.symbol === '005930.KS')?.label).toBe(
                '삼성전자 (005930.KS)'
            );
            const crypto = await loadFearGreedSymbolLinks('crypto', 'ko');
            expect(crypto.map(l => l.symbol).sort()).toEqual(
                [...POPULAR_CRYPTOS].sort()
            );
        });

        it('이름 조회가 비어도 티커 라벨로 링크는 남는다', async () => {
            mockLoadNames.mockResolvedValue(new Map());
            const links = await loadFearGreedSymbolLinks('us', 'ko');
            expect(links.length).toBeGreaterThan(0);
            expect(links.find(l => l.symbol === 'AAPL')?.label).toBe('AAPL');
        });

        /**
         * `/symbols` 페이지와 **같은 캐시 엔트리**를 쓰는 근거: `unstable_cache`의 키는
         * `[NAMES_CACHE_KEY]` + 호출 인자(목록, 로케일)이고 태그·revalidate(24h)는 래퍼 한 곳에
         * 있다. 두 호출부가 같은 인자로 부르면 콜드 렌더가 DB를 한 번 더 치지 않는다.
         */
        it('/symbols 페이지와 같은 인자(전체 인기 목록, 로케일)로 이름을 읽는다', async () => {
            for (const market of ['us', 'kr', 'crypto'] as const) {
                mockLoadNames.mockClear();
                await loadFearGreedSymbolLinks(market, 'ko');
                expect(mockLoadNames).toHaveBeenCalledWith(
                    [...POPULAR_TICKERS, ...POPULAR_CRYPTOS],
                    'ko'
                );
            }
        });

        it('DB 없는 빌드의 degrade revalidate 핀을 건다', async () => {
            await loadFearGreedSymbolLinks('us', 'ko');
            expect(mockShortenDb).toHaveBeenCalledOnce();
        });
    });

    describe('FearGreedRouteBody', () => {
        it('종목마다 /{심볼}/fear-greed 앵커를 서버 렌더한다', async () => {
            const symbolLinks = await loadFearGreedSymbolLinks('us', 'ko');
            const { container } = render(
                <FearGreedRouteBody
                    market="us"
                    view={EMPTY_VIEW}
                    locale="ko"
                    symbolLinks={symbolLinks}
                />
            );
            const hrefs = [
                ...container.querySelectorAll(
                    'section[aria-labelledby="market-fear-greed-symbols-heading"] a'
                ),
            ].map(a => a.getAttribute('href'));
            expect(hrefs).toHaveLength(symbolLinks.length);
            expect(hrefs).toContain('/AAPL/fear-greed');
            const apple = container.querySelector('a[href="/AAPL/fear-greed"]');
            expect(apple).toHaveTextContent('애플 (AAPL)');
        });

        it('목록이 비면 섹션을 생략한다', () => {
            const { container } = render(
                <FearGreedRouteBody market="us" view={EMPTY_VIEW} locale="ko" />
            );
            expect(
                container.querySelector('#market-fear-greed-symbols-heading')
            ).toBeNull();
        });
    });
});
