vi.mock('server-only', () => ({}));

vi.mock('@/entities/market-summary/api/marketSummaryStaticCache', () => ({
    getMarketSummaryStatic: vi.fn(),
}));
vi.mock('@/entities/sector-signal/api/sectorSignalsStaticCache', () => ({
    getSectorSignalsStatic: vi.fn(),
}));

import { generateMetadata, revalidate } from '@/app/[locale]/market/kr/page';
import { MarketRouteBody } from '@/app/[locale]/market/MarketRouteBody';
import { getMarketSummaryStatic } from '@/entities/market-summary/api/marketSummaryStaticCache';
import { getSectorSignalsStatic } from '@/entities/sector-signal/api/sectorSignalsStaticCache';
import { KR_DASHBOARD_SCOPE } from '@/shared/config/dashboardScope';
import { SITE_URL } from '@/shared/lib/seo';

const mockSummary = vi.mocked(getMarketSummaryStatic);
const mockSignals = vi.mocked(getSectorSignalsStatic);

const READY = {
    indices: [
        {
            symbol: 'KS11',
            fmpSymbol: '^KS11',
            displayName: 'KOSPI',
            koreanName: '코스피',
            price: 6977,
            changesPercentage: 1.2,
        },
    ],
    sectors: [],
};

describe('/market/kr page', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockSummary.mockResolvedValue({ indices: [], sectors: [] });
        mockSignals.mockResolvedValue({ computedAt: '', stocks: [] });
    });

    it('caches for an hour, matching /market', () => {
        expect(revalidate).toBe(3600);
    });

    it('loads with the KR scope, never the US one', async () => {
        await generateMetadata({ params: Promise.resolve({ locale: 'ko' }) });

        expect(mockSummary).toHaveBeenCalledWith(KR_DASHBOARD_SCOPE);
        expect(mockSignals).toHaveBeenCalledWith(
            KR_DASHBOARD_SCOPE,
            expect.any(String)
        );
    });

    it('self-canonicals once either loader has content', async () => {
        mockSummary.mockResolvedValue(READY);

        const meta = await generateMetadata({
            params: Promise.resolve({ locale: 'ko' }),
        });
        expect(meta.alternates?.canonical).toBe(`${SITE_URL}/market/kr`);
        expect(meta.robots).toEqual({ index: true, follow: true });
    });

    it('noindexes when both loaders come back empty', async () => {
        const meta = await generateMetadata({
            params: Promise.resolve({ locale: 'ko' }),
        });
        expect(meta.alternates?.canonical).toBeNull();
        expect(meta.robots).toEqual({ index: false, follow: true });
    });

    it('describes the KR market, not the US one', async () => {
        const meta = await generateMetadata({
            params: Promise.resolve({ locale: 'ko' }),
        });
        expect(String(meta.title)).toContain('한국');
        expect(String(meta.description)).toContain('코스피');
        expect(String(meta.title)).not.toContain('미국');
    });

    it('degrades rather than throwing when a loader fails', async () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        mockSummary.mockRejectedValue(new Error('yahoo down'));

        const meta = await generateMetadata({
            params: Promise.resolve({ locale: 'ko' }),
        });
        expect(meta.robots).toEqual({ index: false, follow: true });
        spy.mockRestore();
    });

    it('names the KR market in the breadcrumb', async () => {
        // breadcrumb 이름은 SERP에 실제로 출력되는 문자열이다.
        const tree = await MarketRouteBody({
            locale: 'ko',
            scope: KR_DASHBOARD_SCOPE,
        });
        const json = JSON.stringify(tree);
        expect(json).toContain('한국 시장 현황');
        expect(json).not.toContain('미국 시장 현황');
    });
});
