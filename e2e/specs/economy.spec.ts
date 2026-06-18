import { test, expect } from '../support/fixtures';

/**
 * T3 degrade 시나리오 분류: Tier 3 env-seam 패턴.
 *
 * `E2E_ECONOMY_FORCE_EMPTY=1`을 E2E 빌드 환경변수로 설정하면 `getEconomyProvider`가
 * `EmptyEconomyProvider`를 반환해 전 축 null 스냅샷 → `EconomyDegraded` UI가 렌더된다.
 * 일반 E2E 스위트에서는 skip — 별도 "degrade" 시나리오 빌드에서만 활성화된다.
 *
 * 스킵 조건: `process.env.E2E_ECONOMY_FORCE_EMPTY !== '1'` (서버 프로세스 환경).
 * 활성화 방법: E2E_TEST=1 E2E_ECONOMY_FORCE_EMPTY=1 yarn build && yarn start -p 4300
 */
const FORCE_EMPTY = process.env['E2E_ECONOMY_FORCE_EMPTY'] === '1';

/**
 * /economy — Tier 3 render outcomes.
 *
 * E2E 환경에서는 `FakeEconomyProvider`가 결정적 fixture를 반환한다(부록 A 검증된 9 지표
 * + treasury + US 캘린더 3건). 따라서 안정적 landmark(h1·카테고리 섹션 헤딩·캘린더
 * 헤딩·specific 라벨)를 어서션한다.
 */
test.describe('economy overview', () => {
    test('h1과 세 축(브리핑·지표·캘린더) landmark가 렌더된다', async ({
        page,
    }) => {
        await page.goto('/economy');

        await expect(
            page.getByRole('heading', {
                level: 1,
                name: '미국 경제 — 지표·캘린더 한눈에',
            })
        ).toBeVisible();

        // 카테고리 그룹 헤딩 — Fake fixture가 모든 카테고리에 latest 값을 가짐.
        await expect(
            page.getByRole('heading', { level: 2, name: '경제지표' })
        ).toBeVisible();
        await expect(
            page.getByRole('heading', { level: 3, name: '금리' })
        ).toBeVisible();

        // 캘린더 섹션 헤딩 — h2 텍스트에 ET 힌트 span이 포함되므로 exact: false.
        await expect(
            page.getByRole('heading', { level: 2, name: /경제 캘린더/ })
        ).toBeVisible();
    });

    /**
     * SSR 크롤 텍스트 보장. 지표 카드와 캘린더 이벤트는 서버 컴포넌트라 no-JS HTML에
     * 그대로 박힌다. 검색 엔진이 JS 없이도 거시 데이터를 색인할 수 있어야 한다.
     */
    test('SSR HTML에 지표·캘린더 텍스트가 노출된다 (no-JS crawlers)', async ({
        page,
    }) => {
        const res = await page.request.get('/economy');
        expect(res.status()).toBe(200);
        const html = await res.text();

        // 카테고리 헤딩 (서버 렌더).
        expect(html).toContain('경제지표');
        expect(html).toContain('금리');
        expect(html).toContain('경제 캘린더');

        // Fake fixture가 federalFunds=3.63를 latest로 시드 — 라벨 + 값이 SSR HTML에 있어야 한다.
        expect(html).toContain('연방기금금리');

        // Fake calendar의 첫 이벤트가 Fed Rate Decision — 본문이 SSR로 노출.
        expect(html).toContain('Fed Rate Decision');
    });

    /**
     * 금리 카드 — 2년물·10년물·2s10s 스프레드가 모두 표시되는지 검증.
     * Fake fixture: year2=4.07, year10=4.47 → spread=+0.40.
     */
    test('금리 섹션에 2년물·10년물·2s10s 스프레드 카드가 표시된다', async ({
        page,
    }) => {
        await page.goto('/economy');
        await expect(page.getByText('2년물 국채')).toBeVisible();
        await expect(page.getByText('10년물 국채')).toBeVisible();
        await expect(page.getByText('2s10s 스프레드')).toBeVisible();
    });

    /**
     * MacroBriefing 마운트 후 렌더 — '거시 브리핑' heading이 보이거나
     * skeleton(aria-busy)이 표시돼야 한다.
     *
     * MacroBriefing은 'use client' 위젯이라 마운트 후 submitMacroBriefingAction을
     * 트리거한다. E2E 환경에서는 캐시된 result 또는 skeleton 중 하나가 나타난다.
     */
    test('MacroBriefing 섹션이 마운트 후 렌더 (skeleton/cached/done 중 하나)', async ({
        page,
    }) => {
        await page.goto('/economy');

        // '거시 브리핑' heading이 보이거나 aria-busy skeleton이 노출된다.
        const briefingHeading = page.getByRole('heading', {
            name: /거시 브리핑/,
        });
        const skeleton = page.locator('[aria-busy="true"]');

        await expect(briefingHeading.or(skeleton).first()).toBeVisible({
            timeout: 15_000,
        });
    });

    /**
     * 봇 UA → MacroBriefingBotBlocked 안내 표시.
     *
     * submitMacroBriefingAction은 User-Agent 헤더를 isBot()으로 검사한다. Googlebot UA를
     * 설정하면 botBlocked=true를 반환해 "크롤러 접근으로 분석을 생성하지 않았어요."가 렌더된다.
     * 지표 그리드·캘린더는 SSR이라 봇 UA와 무관하게 항상 렌더된다.
     */
    test('봇 UA에서 MacroBriefing은 차단 안내 노출', async ({ page }) => {
        await page.setExtraHTTPHeaders({
            'User-Agent':
                'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        });

        await page.goto('/economy');

        // 봇 차단 안내 — MacroBriefingBotBlocked 컴포넌트의 복사본.
        await expect(
            page.getByText(/크롤러 접근으로 분석을 생성하지 않았어요/, {
                exact: false,
            })
        ).toBeVisible({ timeout: 15_000 });

        // SSR 섹션(indicator grid·calendar)은 봇 UA와 무관하게 항상 렌더.
        await expect(
            page.getByRole('heading', { level: 2, name: '경제지표' })
        ).toBeVisible();
    });

    /**
     * E2 — 헤더 nav에서 /economy 진입: 홈(/)에서 헤더의 '미국 경제' 링크를
     * 클릭해 /economy로 이동하고 경제 페이지 h1이 표시되는지 검증한다.
     *
     * HeaderNav(client island)와 HeaderNavStatic(PPR fallback) 모두
     * `aria-label="주요 네비게이션"` 아래 `href="/economy"` 링크를 렌더한다.
     * 기존 economy 스펙은 모두 `page.goto('/economy')` 직접 이동만 사용하므로,
     * 이 테스트가 헤더 nav 클릭 경로를 처음으로 검증한다.
     *
     * 헤더 nav 링크는 sm(640px) 이상에서만 표시되므로 데스크톱 뷰포트를 명시한다
     * (playwright.config.ts 기본 프로젝트가 Desktop Chrome이라 별도 설정 불필요).
     */
    test('헤더 "미국 경제" 링크 클릭으로 /economy에 도달하고 h1이 표시된다 (E2)', async ({
        page,
    }) => {
        // 데스크톱 뷰포트 보장 — 헤더 nav 링크는 sm(640px) 이상에서만 표시된다.
        await page.setViewportSize({ width: 1280, height: 800 });
        await page.goto('/');

        // 헤더 주요 네비게이션의 '미국 경제' 링크를 클릭한다.
        const header = page.getByRole('banner');
        await header
            .getByRole('navigation', { name: '주요 네비게이션' })
            .getByRole('link', { name: '미국 경제' })
            .click();

        await page.waitForURL('**/economy');

        // economy 페이지 h1이 보여야 한다.
        await expect(
            page.getByRole('heading', {
                level: 1,
                name: '미국 경제 — 지표·캘린더 한눈에',
            })
        ).toBeVisible();
    });

    /**
     * 모바일 뷰포트(375px)에서 indicator grid가 1-col 레이아웃으로 표시되고
     * 가로 오버플로가 없다.
     *
     * EconomicIndicatorGrid의 grid 컨테이너는 `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`.
     * 375px에서는 sm 브레이크포인트(640px) 미만이라 1열이다.
     * article 카드들의 왼쪽 offset이 모두 동일하면 1열 정렬을 확인할 수 있다.
     *
     * 오버플로 어서션: `scrollWidth - clientWidth > 0`이면 콘텐츠가 뷰포트를 초과해
     * 수평 스크롤이 발생하므로 레이아웃 회귀로 간주한다.
     */
    test('모바일 viewport에서 indicator grid가 1-col으로 정렬', async ({
        page,
    }) => {
        await page.setViewportSize({ width: 375, height: 667 });
        await page.goto('/economy');

        // 그리드 컨테이너가 렌더될 때까지 대기 (grid-cols-1 클래스 포함).
        await expect(
            page.getByRole('heading', { level: 3, name: '금리' })
        ).toBeVisible();

        // 지표 카드들의 x offset이 동일한지 확인 — 1열이면 모두 같은 left offset.
        const articles = page
            .locator(
                'section[aria-labelledby="economy-indicators-heading"] article'
            )
            .first();
        await expect(articles).toBeVisible();

        // 그리드 컨테이너에 grid-cols-1 클래스가 있는지 CSS 클래스로 확인.
        const gridContainer = page
            .locator(
                'section[aria-labelledby="economy-indicators-heading"] .grid'
            )
            .first();
        await expect(gridContainer).toBeVisible();
        await expect(gridContainer).toHaveClass(/grid-cols-1/);

        // 가로 오버플로 없음 — scrollWidth > clientWidth이면 레이아웃 회귀.
        const overflow = await page.evaluate(
            () =>
                document.documentElement.scrollWidth -
                document.documentElement.clientWidth
        );
        expect(
            overflow,
            `/economy 375px: 가로 오버플로 ${overflow}px — 레이아웃 회귀`
        ).toBeLessThanOrEqual(0);
    });
});

/**
 * T3: EconomyDegraded degrade fallback — Tier 3 env-seam 패턴.
 *
 * `E2E_ECONOMY_FORCE_EMPTY=1`으로 빌드된 서버에서만 활성화된다.
 * 일반 E2E 스위트에서는 자동 skip (FORCE_EMPTY=false).
 *
 * 활성화 방법:
 *   E2E_TEST=1 E2E_ECONOMY_FORCE_EMPTY=1 yarn build && yarn start -p 4300
 *   E2E_ECONOMY_FORCE_EMPTY=1 yarn playwright test e2e/specs/economy.spec.ts
 */
test.describe('economy degrade fallback (E2E_ECONOMY_FORCE_EMPTY)', () => {
    test.skip(!FORCE_EMPTY, 'E2E_ECONOMY_FORCE_EMPTY=1 이 아니면 skip');

    test('전 축 결측 시 EconomyDegraded 안내 노출 + metadata noindex', async ({
        page,
    }) => {
        const response = await page.request.get('/economy');
        expect(response.status()).toBe(200);

        // generateMetadata → robots: noindex
        const html = await response.text();
        expect(html).toContain('noindex');

        // EconomyDegraded UI — h2 텍스트
        await page.goto('/economy');
        await expect(
            page.getByRole('heading', { name: '잠시 후 다시 시도해 주세요' })
        ).toBeVisible();

        // EconomyDegraded body copy
        await expect(
            page.getByText(/미국 거시 경제 데이터를 불러오지 못했어요/, {
                exact: false,
            })
        ).toBeVisible();

        // 정상 섹션(indicator grid)은 렌더되지 않아야 한다
        await expect(
            page.getByRole('heading', { level: 2, name: '경제지표' })
        ).not.toBeVisible();
    });
});
