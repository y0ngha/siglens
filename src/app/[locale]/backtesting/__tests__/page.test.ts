/**
 * **부분 목이다.** 통째로 갈아끼우면 이 모듈에 export가 하나 생길 때마다
 * `No "x" export is defined on the mock`으로 깨지고, 더 나쁘게는 URL을 만드는
 * 로직이 스텁으로 대체돼 테스트가 아무것도 검증하지 못한다.
 */
vi.mock('@/shared/lib/seo', async importOriginal => ({
    ...(await importOriginal<typeof import('@/shared/lib/seo')>()),
    backtestingDescription: () => 'test desc',
    backtestingTitle: () => 'AI 백테스팅',
    BACKTESTING_KEYWORDS: ['backtest'],
    BACKTESTING_URL: 'https://siglens.io/backtesting',
    buildWebPageJsonLd: () => ({}),
    buildBreadcrumbJsonLd: vi.fn().mockReturnValue({}),
    SITE_BUILD_DATE: new Date('2025-01-01'),
    SITE_URL: 'https://siglens.io',
}));
vi.mock('@/shared/lib/og', () => ({
    OG_IMAGE_WIDTH: 1200,
    OG_IMAGE_HEIGHT: 630,
}));
vi.mock('@/shared/lib/legal', () => ({
    TERMS_PATH: '/terms',
}));
vi.mock('@/widgets/backtesting/BacktestHero', () => ({
    BacktestHero: () => null,
}));
vi.mock('@/widgets/backtesting/BacktestComparison', () => ({
    BacktestComparison: () => null,
}));
vi.mock('@/widgets/backtesting/BacktestTrendRecognition', () => ({
    BacktestTrendRecognition: () => null,
}));
vi.mock('@/widgets/backtesting/BacktestStrategy', () => ({
    BacktestStrategy: () => null,
}));
vi.mock('@/widgets/backtesting/BacktestTabs', () => ({
    BacktestTabs: () => null,
}));
vi.mock('@/shared/ui/JsonLd', () => ({ JsonLd: () => null }));
vi.mock('@/entities/backtest-case/data/data.json', () => ({
    default: {
        // `validateBacktestRunData`가 항등함수로 mock되므로 이 픽스처가 곧 런타임 shape다.
        run: {
            runId: '2026-11-daily-ai',
            tickers: ['AAPL', 'TSLA'],
            resultsUrl:
                'https://github.com/y0ngha/siglens/tree/master/backtest-results/2026-11-daily-ai',
        },
        baselines: [],
        trades: [],
    },
}));
vi.mock('@/entities/backtest-case/lib/validate', () => ({
    validateBacktestRunData: vi
        .fn()
        .mockImplementation((data: unknown) => data),
}));
vi.mock('@/entities/backtest-case/lib/deriveBacktestStats', () => ({
    deriveBacktestStats: vi.fn().mockReturnValue({
        periodStart: '',
        periodEnd: '',
    }),
}));

import { generateMetadata } from '@/app/[locale]/backtesting/page';

const metadataFor = (locale = 'ko') =>
    generateMetadata({ params: Promise.resolve({ locale }) });

describe('Backtesting page', () => {
    it('exports metadata with backtesting title', async () => {
        const metadata = await metadataFor();
        expect(metadata.title).toEqual(
            expect.objectContaining({
                absolute: expect.stringContaining('백테스팅'),
            })
        );
    });

    it('sets canonical to backtesting URL', async () => {
        const metadata = await metadataFor();
        expect(metadata.alternates?.canonical).toBe(
            'https://siglens.io/backtesting'
        );
    });

    it('includes openGraph metadata', async () => {
        const metadata = await metadataFor();
        expect(metadata.openGraph).toBeDefined();
    });

    it('includes twitter card metadata', async () => {
        const metadata = await metadataFor();
        expect(metadata.twitter).toBeDefined();
        expect(metadata.twitter).toEqual(
            expect.objectContaining({ card: 'summary_large_image' })
        );
    });
});
