// @vitest-environment jsdom
//
// Verifies the Dataset JSON-LD fields composed in the page's private
// `buildBacktestingJsonLd`. Separate file from `page.test.ts`/`page.ssr.test.tsx`:
// those mock `@/shared/ui/JsonLd` as `() => null` (their concern is metadata /
// visible SSR content), so neither ever inspects the `data` prop passed to it.
// This file spies on that prop instead, and gives `deriveBacktestStats` distinct
// non-empty `periodStart`/`periodEnd` so a slash omission or field-order swap in
// `temporalCoverage` actually changes the asserted string (the shared mock in
// `page.test.ts` uses `''` for both, which can't tell a swap from the original).

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
vi.mock('next/navigation', () => ({
    useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
    usePathname: () => '/backtesting',
}));
const jsonLdSpy = vi.fn();
vi.mock('@/shared/ui/JsonLd', () => ({
    JsonLd: ({ data }: { data: Record<string, unknown> }) => {
        jsonLdSpy(data);
        return null;
    },
}));
vi.mock('@/app/[locale]/backtesting/data.json', () => ({
    default: {
        meta: { totalCases: 1, totalTickers: 1 },
        // `validateBacktestData`가 항등함수로 mock되므로 이 픽스처가 곧 런타임 shape다.
        cases: [
            {
                ticker: 'AAPL',
                date: '2025-01-01',
                signal: 'buy',
                aiAnalysis: { bullishTargets: [] },
            },
        ],
    },
}));
vi.mock('@/entities/backtest-case', () => ({
    validateBacktestData: vi.fn().mockImplementation((data: unknown) => data),
    deriveBacktestStats: vi.fn().mockReturnValue({
        totalCases: 1,
        indicatorWins: 0,
        indicatorWinRate: 0,
        aiDecisiveCount: 0,
        aiWins: 0,
        aiWinRateDecisive: 0,
        aiNeutralCount: 0,
        aiTrendHitRate: 0,
        meanReturnPct: 0,
        medianHoldingDays: 0,
        // 실제 진입일 범위와 같은 모양(연-월)의 서로 다른 값 — 슬래시 누락이나
        // start/end 순서 바뀜을 실제로 잡아낸다.
        periodStart: '2024-11',
        periodEnd: '2026-03',
    }),
}));

import { renderToStaticMarkup } from 'react-dom/server';
import BacktestingPage from '@/app/[locale]/backtesting/page';
import { IntlTestProvider } from '@/shared/test-utils/intlRenderWrapper';

describe('/backtesting Dataset JSON-LD', () => {
    it('composes temporalCoverage from derived stats and drops the fake dateModified', async () => {
        renderToStaticMarkup(
            <IntlTestProvider>
                {await BacktestingPage({
                    params: Promise.resolve({ locale: 'ko' }),
                })}
            </IntlTestProvider>
        );

        const datasetCall = jsonLdSpy.mock.calls.find(
            ([data]) => data['@type'] === 'Dataset'
        );
        expect(datasetCall).toBeDefined();
        const dataset = datasetCall![0] as {
            temporalCoverage: string;
            distribution: Array<Record<string, unknown>>;
        };

        expect(dataset.temporalCoverage).toBe('2024-11/2026-03');
        expect(dataset.distribution[0]).not.toHaveProperty('dateModified');
    });

    /**
     * `dateModified`는 **데이터의 마지막 진입일**이다 — 배포 시각이 아니다.
     *
     * 통계의 `periodEnd` 문자열을 그대로 쓴다. `Date`로 정규화하면 연-월(`2026-03`)이
     * 3월 1일로 파싱돼(V8 실측) 모르는 날짜를 주장하게 되므로, 정밀도를 바꾸지 않는
     * 것이 정직하다. 값이 비면 필드를 싣지 않는다(`page.test.ts`의 `periodEnd: ''` 모의).
     */
    it('dateModified가 periodEnd 문자열 그대로다 — 정밀도를 올리지 않는다', async () => {
        renderToStaticMarkup(
            <IntlTestProvider>
                {await BacktestingPage({
                    params: Promise.resolve({ locale: 'ko' }),
                })}
            </IntlTestProvider>
        );

        const dataset = jsonLdSpy.mock.calls.find(
            ([data]) => data['@type'] === 'Dataset'
        )![0] as Record<string, unknown>;

        expect(dataset.dateModified).toBe('2026-03');
        expect(dataset.temporalCoverage).toBe('2024-11/2026-03');
    });
});
