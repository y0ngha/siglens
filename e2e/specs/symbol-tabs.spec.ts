import { test, expect } from '../support/fixtures';
import { freezeClock } from '../support/clock';

/**
 * `@webkit`-tagged symbol-tabs spec — Task 4 of the E2E Tier 1 plan.
 *
 * Runs on BOTH Playwright projects: chromium (Desktop Chrome, runs every spec)
 * and webkit (iPhone 14 mobile viewport, runs only `@webkit`-tagged specs). So
 * every selector here must be viewport-independent.
 *
 * Selector strategy (verified against the real DOM, NOT the unit-test mocks):
 *
 *   - The 6 tabs live in a layout-level `<nav aria-label="분석 종류">`
 *     (SymbolTabs in SymbolLayoutHeader), rendered on every `/[symbol]/*` page.
 *     Tabs are URL-driven `<Link>`s, NOT a tablist: the active tab carries
 *     `aria-current="page"`. We assert the active state via that attribute,
 *     scoped to the nav landmark.
 *
 *   - Each sibling route (news/fundamental/options/fear-greed/overall) renders
 *     a visible, RSC-emitted `<h1>` via `SymbolPageHeading` BEFORE any
 *     client-side analysis hydration, so it is present in the SSR HTML and is
 *     viewport-independent (no `md:` gating, not inside the desktop analysis
 *     `<aside>` nor the mobile sheet). The chart route (`/[symbol]`) renders an
 *     inline `<h1>{displayName} 차트 분석` in SymbolPageClient's timeframe bar.
 *     These page h1s are the most reliable per-tab content markers because they
 *     do NOT depend on FMP/Yahoo/LLM data (which is faked/short-circuited under
 *     E2E) — they render from the seeded asset row alone.
 *
 *   - We deliberately AVOID asserting the analysis body (which on webkit lives
 *     in the `MobileAnalysisSheet` bottom sheet, not the desktop `<aside>`
 *     `role="complementary"` that is hidden below `md`) and FMP/Yahoo-backed
 *     section content (fundamental cards, options metrics) for the navigation
 *     test, since their presence is data-dependent under E2E. The page h1 +
 *     active-tab state are the stable, always-present outcomes.
 */

const TAB_NAV_NAME = '분석 종류';

// 차트 페이지 h1은 SymbolPageClient의 timeframe bar 안에 인라인으로 렌더된다.
const CHART_H1 = /차트 분석/;

// 각 sibling 라우트의 가시 h1(SymbolPageHeading) 텍스트 — page.tsx에서 직접 추출.
const TABS = [
    {
        key: 'chart',
        label: '차트',
        path: '/AAPL',
        urlRe: /\/AAPL(\?.*)?$/,
        heading: CHART_H1,
    },
    {
        key: 'news',
        label: '뉴스',
        path: '/AAPL/news',
        urlRe: /\/AAPL\/news$/,
        heading: /최신 뉴스와 어닝 일정/,
    },
    {
        key: 'fundamental',
        label: '펀더멘털',
        path: '/AAPL/fundamental',
        urlRe: /\/AAPL\/fundamental$/,
        heading: /재무지표와 애널리스트 의견/,
    },
    {
        key: 'options',
        label: '옵션',
        path: '/AAPL/options',
        urlRe: /\/AAPL\/options$/,
        // 옵션 데이터 유무에 따라 정상 h1("옵션 시장 분석") 또는 빈 상태
        // h1("옵션 시장 정보 없음")이 렌더되므로 둘 다 매칭한다.
        heading: /옵션 시장 (분석|정보 없음)/,
    },
    {
        key: 'fear-greed',
        label: '공포 탐욕 지수',
        path: '/AAPL/fear-greed',
        urlRe: /\/AAPL\/fear-greed$/,
        heading: /공포 탐욕 지수와 단기 매수 분위기/,
    },
    {
        key: 'overall',
        label: '종합',
        path: '/AAPL/overall',
        urlRe: /\/AAPL\/overall$/,
        heading: /차트와 옵션 시장, 실적, 뉴스 종합 분석/,
    },
] as const;

test.describe('@webkit symbol tabs', () => {
    test('@webkit navigates through all 6 tabs and renders each tab marker', async ({
        page,
    }) => {
        // 모바일 webkit + CI 콜드빌드 병렬 부하에서 6탭 순회(RSC 네비 + 하이드레이션)는
        // 탭당 수 초가 걸릴 수 있어 기본 30s를 넘길 수 있다. 넉넉히 상향한다.
        test.setTimeout(90_000);

        await page.goto('/AAPL');

        const tabNav = page.getByRole('navigation', { name: TAB_NAV_NAME });
        await expect(tabNav).toBeVisible();

        for (const tab of TABS) {
            // 탭 nav는 모바일에서 가로 스크롤되므로 클릭 전 명시적으로 가시 영역에
            // 들여온다(webkit click auto-scroll 타이밍 flake 방지).
            const link = tabNav.getByRole('link', {
                name: tab.label,
                exact: true,
            });
            await link.scrollIntoViewIfNeeded();
            await link.click();

            // 1) 먼저 네비게이션이 커밋될 때까지 기다린다 — 이후 활성 상태/h1
            //    단언이 정착된 페이지에서 실행되도록 (webkit/CI 지연 대비).
            await page.waitForURL(tab.urlRe, { timeout: 15_000 });

            // 2) 활성 탭이 aria-current="page"를 갖는다 (URL 기반 활성 상태).
            await expect(
                tabNav.getByRole('link', { name: tab.label, exact: true })
            ).toHaveAttribute('aria-current', 'page', { timeout: 15_000 });

            // 3) 탭별 가시 h1 마커가 보인다 (RSC SSR, 뷰포트 독립, 데이터 비의존).
            //    차트 h1은 여러 후보(브레드크럼 등)와 충돌하지 않도록 level=1로 한정.
            await expect(
                page.getByRole('heading', { level: 1, name: tab.heading })
            ).toBeVisible({ timeout: 15_000 });
        }
    });

    test('@webkit options page renders options analysis surface', async ({
        page,
    }) => {
        // US 주말(2026-05-30 토요일) 정규장 마감 시점으로 시계를 고정한다.
        // OptionsStaleDataBanner는 (1) !isEtRegularSessionOpen(now) AND
        // (2) OI 스냅샷의 95%+ contract가 OI=0 일 때만 렌더된다. (2)는 E2E에서
        // 옵션 스냅샷 데이터에 의존하므로, 배너 트리거가 보장되지 않으면 옵션
        // 페이지가 정상 렌더(또는 빈 상태)됨을 검증하는 것으로 reduce 한다.
        // freezeClock은 분석 진행 애니메이션을 멈추므로 이 테스트에서는 분석
        // 본문을 기다리지 않고 옵션 표면(stale 배너 OR Max Pain OR 빈 상태)만
        // 검증한다.
        await freezeClock(page, '2026-05-30T20:00:00Z');

        await page.goto('/AAPL/options');

        // 옵션 페이지가 렌더됐음을 보장하는 always-present 마커:
        //   - stale 배너 (role="status", "옵션 OI 데이터가 비어 있어요"), 또는
        //   - 데이터 있는 정상 페이지의 "Max Pain" metric 카드, 또는
        //   - 옵션 시장이 없는 종목의 빈 상태 h1.
        const staleBanner = page.getByRole('status').filter({
            hasText: '옵션 OI 데이터가 비어 있어요',
        });
        const maxPainCard = page.getByText('Max Pain', { exact: true });
        const emptyState = page.getByRole('heading', {
            level: 1,
            name: /옵션 시장 정보 없음/,
        });

        await expect(
            staleBanner.or(maxPainCard).or(emptyState).first()
        ).toBeVisible({ timeout: 15_000 });
    });
});
