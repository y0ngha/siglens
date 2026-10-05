/**
 * 공포·탐욕 탭 `WebPage.dateModified` — **마지막 점수 봉의 세션 마감 순간**.
 *
 * 이 탭의 본문은 일봉에서 결정적으로 계산되므로 내용이 바뀐 시점은 그 봉이 마감된 때다.
 * sitemap `lastmod`(`buildPopularEntries`의 `todayClose`)와 같은 정의다. 점수는 실제
 * `computeFearGreedIndex`로 계산한다(모킹하면 마지막 점수 봉 날짜를 알 수 없다).
 */
const { mockGetAssetInfoResilient, mockGetQuantizedBarsStatic } = vi.hoisted(
    () => ({
        mockGetAssetInfoResilient: vi.fn(),
        mockGetQuantizedBarsStatic: vi.fn(),
    })
);

vi.mock('@tanstack/react-query', () => ({
    dehydrate: () => ({}),
    HydrationBoundary: () => null,
    QueryClient: function MockQueryClientClass() {
        return { setQueryData: vi.fn() };
    },
}));
vi.mock('@/entities/ticker/lib/assetClassification', () => ({
    buildAssetAboutNode: vi.fn().mockReturnValue(undefined),
}));
vi.mock('@/entities/ticker/lib/ticker', () => ({
    pickAssetName: (info: { name: string }) => info.name,
    buildDisplayName: vi.fn().mockReturnValue('Apple Inc.'),
}));
vi.mock('@/entities/ticker/lib/getAssetInfoResilient', () => ({
    getAssetInfoResilient: (ticker: string) =>
        mockGetAssetInfoResilient(ticker),
}));
vi.mock('@/entities/bars/lib/barsStaticCache', () => ({
    getQuantizedBarsStatic: mockGetQuantizedBarsStatic,
    getSeedBarsStatic: vi.fn(),
}));
vi.mock('@/entities/market-fear-greed/api/marketFearGreedReading', () => ({
    getMarketFearGreedReading: vi.fn().mockResolvedValue(null),
}));
vi.mock('next/navigation', () => ({ notFound: vi.fn() }));
vi.mock('@/widgets/fear-greed/FearGreedPage', () => ({
    FearGreedPage: () => null,
}));
vi.mock('@/widgets/fear-greed/FearGreedPageError', () => ({
    FearGreedPageError: () => null,
}));
vi.mock('@/views/symbol/ui/SymbolPageHeading', () => ({
    SymbolPageHeading: () => null,
}));
vi.mock('@/shared/ui/CrossLinkCards', () => ({ CrossLinkCards: () => null }));
vi.mock('@/shared/ui/JsonLd', () => ({ JsonLd: () => null }));
vi.mock('react-error-boundary', () => ({
    ErrorBoundary: ({ children }: { children: React.ReactNode }) => children,
}));

import { describe, expect, it, beforeEach, vi } from 'vitest';
import { US_EQUITY_SESSION } from '@y0ngha/siglens-core';
import SymbolFearGreedPage from '@/app/[locale]/[symbol]/fear-greed/page';
import { buildFearGreedSeedBars } from '@/__tests__/utils/fearGreedSeedBars';
import { collectJsonLdData } from '@/__tests__/utils/collectJsonLdData';
import { sessionCloseUtcOnDate } from '@/shared/lib/marketSessionDate';
import { toUtcIsoDate } from '@/shared/lib/isoDate';

const ASSET = {
    assetInfo: { symbol: 'AAPL', name: 'Apple Inc.', fmpSymbol: 'AAPL' },
    degraded: false,
};

async function webPageOf(bars: ReturnType<typeof buildFearGreedSeedBars>) {
    mockGetQuantizedBarsStatic.mockResolvedValue(bars);
    const tree = await SymbolFearGreedPage({
        params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
    });
    return collectJsonLdData(tree).find(d => d['@type'] === 'WebPage') as
        | { dateModified?: string }
        | undefined;
}

describe('fear-greed WebPage.dateModified', () => {
    beforeEach(() => {
        mockGetAssetInfoResilient.mockReset();
        mockGetQuantizedBarsStatic.mockReset();
        mockGetAssetInfoResilient.mockResolvedValue(ASSET);
    });

    it('마지막 점수 봉의 세션 마감 순간이다(요청·빌드 시각이 아니다)', async () => {
        const bars = buildFearGreedSeedBars(300);
        const lastTime = bars.bars.at(-1)!.time;
        const lastDate = toUtcIsoDate(new Date(lastTime * 1000));

        const webPage = await webPageOf(bars);

        expect(webPage?.dateModified).toBe(
            sessionCloseUtcOnDate(US_EQUITY_SESSION, lastDate).toISOString()
        );
    });

    it('점수를 못 내면 신선도를 주장하지 않는다(dateModified 생략)', async () => {
        const webPage = await webPageOf(buildFearGreedSeedBars(20));

        expect(webPage).toBeDefined();
        expect(webPage).not.toHaveProperty('dateModified');
    });
});
