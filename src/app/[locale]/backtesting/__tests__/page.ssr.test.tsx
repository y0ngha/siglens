// @vitest-environment jsdom
//
// Proves the /backtesting fix actually works, not just "looks correct".
//
// React does not run useEffect during server rendering — renderToStaticMarkup
// mirrors that (unlike @testing-library/react's render(), which flushes effects
// via act() and would hide this bug). Before the fix, the visible case list was
// derived synchronously from useSearchParams()/useQueryParamState during render,
// so a Suspense boundary wrapping that subtree caused Next.js to statically bake
// only the "로딩 중..." fallback — the 100 cases never reached crawlers.
//
// This test renders the real page tree (no widget mocks) with renderToStaticMarkup
// and asserts real data.json case content is present in that first, effect-free
// pass — the same pass that becomes the static SSR HTML in production.
import { renderToStaticMarkup } from 'react-dom/server';

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
vi.mock('next/navigation', () => ({
    useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
    usePathname: () => '/backtesting',
}));

import BacktestingPage from '@/app/[locale]/backtesting/page';
import { IntlTestProvider } from '@/shared/test-utils/intlRenderWrapper';
import backtestData from '@/app/[locale]/backtesting/data.json';

describe('/backtesting SSR output', () => {
    it('renders every real case ticker in the effect-free first render pass', async () => {
        // `renderToStaticMarkup`은 RTL을 거치지 않아 전역 i18n wrapper가 닿지
        // 않는다(vitest.setup.dom.ts는 `render`/`renderHook`만 감싼다). 직접 감싼다.
        const html = renderToStaticMarkup(
            <IntlTestProvider>
                {await BacktestingPage({
                    params: Promise.resolve({ locale: 'ko' }),
                })}
            </IntlTestProvider>
        );

        const tickers = [...new Set(backtestData.cases.map(c => c.ticker))];
        // Full 100-case list must reach the static shell — not just the first
        // ticker, since a partial (e.g. pre-filtered) render would still pass
        // a single-ticker assertion.
        for (const ticker of tickers) {
            expect(html).toContain(ticker);
        }
        expect(html).not.toContain('로딩 중');
    });

    it('does not filter the list based on the current URL before hydration', async () => {
        // Even if the browser URL already carries a deep link, the effect-free
        // render pass (= SSR) must ignore it and show the full list; only the
        // post-mount effect may narrow it.
        window.history.pushState({}, '', '/backtesting?ticker=GOOGL');

        // `renderToStaticMarkup`은 RTL을 거치지 않아 전역 i18n wrapper가 닿지
        // 않는다(vitest.setup.dom.ts는 `render`/`renderHook`만 감싼다). 직접 감싼다.
        const html = renderToStaticMarkup(
            <IntlTestProvider>
                {await BacktestingPage({
                    params: Promise.resolve({ locale: 'ko' }),
                })}
            </IntlTestProvider>
        );

        const otherTickerCase = backtestData.cases.find(
            c => c.ticker !== 'GOOGL'
        );
        expect(otherTickerCase).toBeDefined();
        expect(html).toContain(otherTickerCase!.ticker);
    });
});
