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
        // `validateBacktestData`가 항등함수로 mock되므로 이 픽스처가 곧 런타임 shape다.
        // `aiAnalysis.bullishTargets`는 page 모듈이 클라이언트 프로젝션에서 실제로
        // 읽는다 — 빼면 import 시점에 터진다(실 데이터에서는 validate가 보장하는 필드).
        cases: [
            {
                ticker: 'AAPL',
                date: '2025-01-01',
                signal: 'buy',
                aiAnalysis: {
                    bullishTargets: [
                        { price: 125, basis: '직전 저항선' },
                        { price: 140, basis: '전고점' },
                    ],
                },
            },
            {
                ticker: 'TSLA',
                date: '2025-01-01',
                signal: 'buy',
                aiAnalysis: { bullishTargets: [] },
            },
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
