vi.mock('@/shared/lib/seo', () => ({
    BACKTESTING_DESCRIPTION: 'test desc',
    BACKTESTING_KEYWORDS: ['backtest'],
    BACKTESTING_TITLE: 'AI 백테스팅',
    BACKTESTING_URL: 'https://siglens.io/backtesting',
    buildBreadcrumbJsonLd: vi.fn().mockReturnValue({}),
    SITE_BUILD_DATE: new Date('2025-01-01'),
    SITE_NAME: 'Siglens',
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
vi.mock('@/widgets/backtesting/BacktestTabs', () => ({
    BacktestTabs: () => null,
}));
vi.mock('@/shared/ui/JsonLd', () => ({ JsonLd: () => null }));
vi.mock('@/app/backtesting/data.json', () => ({
    default: {
        meta: { totalCases: 10, totalTickers: 5 },
        cases: [
            { ticker: 'AAPL', date: '2025-01-01', signal: 'buy' },
            { ticker: 'TSLA', date: '2025-01-01', signal: 'buy' },
        ],
    },
}));
vi.mock('@/entities/backtest-case', () => ({
    validateBacktestData: vi.fn().mockImplementation((data: unknown) => data),
}));

import { metadata } from '@/app/backtesting/page';

describe('Backtesting page', () => {
    it('exports metadata with backtesting title', () => {
        expect(metadata.title).toEqual(
            expect.objectContaining({
                absolute: expect.stringContaining('백테스팅'),
            })
        );
    });

    it('sets canonical to backtesting URL', () => {
        expect(metadata.alternates?.canonical).toBe(
            'https://siglens.io/backtesting'
        );
    });

    it('includes openGraph metadata', () => {
        expect(metadata.openGraph).toBeDefined();
    });

    it('includes twitter card metadata', () => {
        expect(metadata.twitter).toBeDefined();
        expect(metadata.twitter).toEqual(
            expect.objectContaining({ card: 'summary_large_image' })
        );
    });
});
