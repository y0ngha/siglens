import { test, expect } from '../support/fixtures';
import { settlePwaBanner } from '../support/pwaBanner';

/**
 * Mobile nav drawer (`@webkit`) — HeaderMobileMenu hydration + interaction guard.
 *
 * `HeaderMobileMenu` is a `'use client'` component rendered inside `lg:hidden`,
 * so it appears below lg (< 1024px) — the breakpoint moved up from `md` when the
 * nav labels grew a market prefix ("미국 시장 분석" 등) and started wrapping inside
 * the fixed 56px header row. It must stay paired with `Header.tsx`'s
 * `hidden lg:flex` (see `widgets/layout/__tests__/navBreakpointPairing.dom-fast.test.tsx`).
 * The webkit project uses
 * `devices['iPhone 14']` (~390px), so the hamburger renders there.
 *
 * The tests act as a hydration guard: a dead / un-hydrated button leaves the
 * drawer `inert` permanently and the trigger label never flips to "메뉴 닫기".
 * A real click that opens the drawer proves React hydration ran successfully
 * on the client.
 *
 * The drawer is always in the DOM (SSR: crawlers see the nav links), but:
 *   - Closed: `inert` + `translate-x-full` → out of the tab order and AT, off-screen.
 *   - Open:   `inert` removed + `translate-x-0` → focusable, on-screen.
 *
 * Closed-state assertions use the raw `[role="dialog"]` locator and assert the
 * `inert` attribute so the check is independent of CSS geometry.
 */

/** Raw locator for the drawer — works regardless of the inert state. */
const drawerSelector = '[role="dialog"][aria-label="메뉴"]';

test.describe('@webkit 모바일 햄버거 내비게이션', () => {
    /**
     * 1. 햄버거 클릭 시 드로어가 실제로 열린다.
     *
     * Proves hydration ran: a static (un-hydrated) button cannot toggle state,
     * so the drawer stays `inert` and the label never flips.
     */
    test('@webkit 햄버거 클릭 시 드로어가 실제로 열린다', async ({ page }) => {
        test.skip(
            test.info().project.name !== 'webkit',
            '모바일 햄버거 메뉴는 webkit(모바일) 프로젝트에서만 실행된다'
        );

        await page.goto('/');
        await settlePwaBanner(page);

        const trigger = page.getByRole('button', { name: '메뉴 열기' });
        await expect(trigger).toBeVisible();
        await expect(trigger).toHaveAttribute('aria-expanded', 'false');

        await trigger.click();

        const drawer = page.getByRole('dialog', { name: '메뉴' });
        await expect(drawer).toBeVisible();
        await expect(drawer).not.toHaveAttribute('inert');

        const closeLabel = page.getByRole('button', { name: '메뉴 닫기' });
        await expect(closeLabel).toBeVisible();
        await expect(closeLabel).toHaveAttribute('aria-expanded', 'true');

        // 지역 라벨은 버티컬 안에서만 유일하다(`미국`이 네 번 나온다) — 그룹으로
        // 좁힌 뒤 이름으로 집는다.
        await expect(
            drawer
                .getByRole('group', { name: '경제' })
                .getByRole('link', { name: '미국', exact: true })
        ).toHaveAttribute('href', '/economy');
    });

    /**
     * 2. 햄버거를 다시 누르면 닫힌다 (toggle).
     */
    test('@webkit 햄버거를 다시 누르면 닫힌다 (toggle)', async ({ page }) => {
        test.skip(
            test.info().project.name !== 'webkit',
            '모바일 햄버거 메뉴는 webkit(모바일) 프로젝트에서만 실행된다'
        );

        await page.goto('/');
        await settlePwaBanner(page);

        await page.getByRole('button', { name: '메뉴 열기' }).click();
        await expect(page.getByRole('dialog', { name: '메뉴' })).toBeVisible();

        // 열린 상태에서 트리거는 전체화면 백드롭(z-40)에 덮여 포인터 hit-test로는
        // 닿지 않는다(스크린리더 가상 커서·키보드 활성화 경로). dispatchEvent로
        // 실제 click 이벤트를 발생시켜 toggle 핸들러가 hydration 후 닫는지 검증한다.
        await page
            .getByRole('button', { name: '메뉴 닫기' })
            .dispatchEvent('click');

        await expect(page.locator(drawerSelector)).toHaveAttribute('inert');
    });

    /**
     * 3. Escape로 닫히고 포커스가 트리거로 복귀한다.
     */
    test('@webkit Escape로 닫히고 포커스가 트리거로 복귀', async ({ page }) => {
        test.skip(
            test.info().project.name !== 'webkit',
            '모바일 햄버거 메뉴는 webkit(모바일) 프로젝트에서만 실행된다'
        );

        await page.goto('/');
        await settlePwaBanner(page);

        await page.getByRole('button', { name: '메뉴 열기' }).click();
        await expect(page.getByRole('dialog', { name: '메뉴' })).toBeVisible();

        await page.keyboard.press('Escape');

        await expect(page.locator(drawerSelector)).toHaveAttribute('inert');

        // `useMobileDrawer`의 close 콜백이 triggerRef.current?.focus()를 호출하므로
        // 포커스가 햄버거 트리거로 복귀한다.
        const trigger = page.getByRole('button', { name: '메뉴 열기' });
        await expect(trigger).toBeFocused();
    });

    /**
     * 4. 드로어 링크 클릭 시 닫히고 해당 URL로 이동한다.
     */
    test('@webkit 드로어 링크 클릭 시 닫히고 이동', async ({ page }) => {
        test.skip(
            test.info().project.name !== 'webkit',
            '모바일 햄버거 메뉴는 webkit(모바일) 프로젝트에서만 실행된다'
        );

        await page.goto('/');
        await settlePwaBanner(page);

        await page.getByRole('button', { name: '메뉴 열기' }).click();
        const drawer = page.getByRole('dialog', { name: '메뉴' });
        await expect(drawer).toBeVisible();

        // Link의 onClick={close} 핸들러가 탐색 전에 드로어를 닫는다.
        await drawer
            .getByRole('group', { name: '경제' })
            .getByRole('link', { name: '미국', exact: true })
            .click();

        await page.waitForURL('**/economy');

        // 이동 후 드로어가 닫혀 있어야 한다.
        await expect(page.locator(drawerSelector)).toHaveAttribute('inert');
    });

    /**
     * 5. 백드롭 클릭 / X 버튼으로 닫힌다.
     */
    test('@webkit 백드롭/X로 닫힌다', async ({ page }) => {
        test.skip(
            test.info().project.name !== 'webkit',
            '모바일 햄버거 메뉴는 webkit(모바일) 프로젝트에서만 실행된다'
        );

        await page.goto('/');
        await settlePwaBanner(page);

        // (a) 백드롭 클릭으로 닫기.
        await page.getByRole('button', { name: '메뉴 열기' }).click();
        await expect(page.getByRole('dialog', { name: '메뉴' })).toBeVisible();

        // 백드롭(z-40)은 전체화면이지만 webkit 스택킹 컨텍스트상 포인터 hit-test가
        // 불안정하다(드로어/페이지 섹션이 가로채임). dispatchEvent로 백드롭의 onClick
        // 핸들러를 직접 발생시켜 닫힘을 검증한다(hydration된 핸들러만 동작).
        await page
            .locator('[data-testid="mobile-nav-backdrop"]')
            .dispatchEvent('click');

        await expect(page.locator(drawerSelector)).toHaveAttribute('inert');

        // (b) X 버튼('메뉴 패널 닫기')으로 닫기.
        await page.getByRole('button', { name: '메뉴 열기' }).click();
        await expect(page.getByRole('dialog', { name: '메뉴' })).toBeVisible();

        await page.getByRole('button', { name: '메뉴 패널 닫기' }).click();

        await expect(page.locator(drawerSelector)).toHaveAttribute('inert');
    });

    /**
     * 6. 드로어 열림 시 body 스크롤 잠금.
     *
     * HeaderMobileMenu의 useEffect가 isOpen=true일 때
     * `document.body.style.overflow = 'hidden'`을 적용한다.
     * 이 테스트는 그 side-effect가 실제로 실행됐음을 검증한다.
     */
    test('@webkit 드로어 열림 시 body 스크롤 잠금', async ({ page }) => {
        test.skip(
            test.info().project.name !== 'webkit',
            '모바일 햄버거 메뉴는 webkit(모바일) 프로젝트에서만 실행된다'
        );

        await page.goto('/');
        await settlePwaBanner(page);

        await page.getByRole('button', { name: '메뉴 열기' }).click();
        await expect(page.getByRole('dialog', { name: '메뉴' })).toBeVisible();

        // useEffect가 반영될 때까지 재시도한다.
        await expect
            .poll(
                () =>
                    page.evaluate(
                        () => getComputedStyle(document.body).overflow
                    ),
                { timeout: 5_000 }
            )
            .toBe('hidden');
    });

    /**
     * 7. 좁은 폰 폭에서 햄버거가 화면 안에 온전히 선다.
     *
     * 헤더 한 줄에 44px 아이콘이 여섯 개 서면서 360~390px 폰에서 맨 끝의 햄버거가 화면 밖으로
     * 잘렸다(운영 실측: 360px에서 x=348~392). `toBeVisible()`은 일부만 보여도 통과하므로 위
     * 테스트들은 이걸 못 잡는다 — 버튼 상자가 뷰포트 안에 다 들어오는지, 문서에 가로 스크롤이
     * 없는지를 직접 잰다. 헤더에 아이콘을 더하면 이 테스트가 먼저 깨져야 한다(`Header.tsx` "폭 예산").
     */
    for (const width of [320, 360, 390]) {
        test(`@webkit ${width}px 폭에서 햄버거가 화면 안에 온전히 선다`, async ({
            page,
        }) => {
            test.skip(
                test.info().project.name !== 'webkit',
                '모바일 햄버거 메뉴는 webkit(모바일) 프로젝트에서만 실행된다'
            );

            await page.setViewportSize({ width, height: 740 });
            await page.goto('/');
            await settlePwaBanner(page);

            const trigger = page.getByRole('button', { name: '메뉴 열기' });
            await expect(trigger).toBeVisible();
            const box = await trigger.boundingBox();
            expect(box).not.toBeNull();
            if (box === null) return;
            expect(box.x).toBeGreaterThanOrEqual(0);
            expect(box.x + box.width).toBeLessThanOrEqual(width);

            const scrollWidth = await page.evaluate(
                () => document.documentElement.scrollWidth
            );
            expect(scrollWidth).toBeLessThanOrEqual(width);
        });
    }

    /**
     * 8. 폰 폭에서는 테마 토글이 헤더 줄이 아니라 드로어에 있다.
     *
     * 헤더 줄에서 뺀 컨트롤은 드로어에서 닿아야 한다 — 두 쪽의 경계가 어긋나면 어느 쪽에도 없는
     * 폭이 생긴다.
     */
    test('@webkit 폰 폭에서 테마 토글은 드로어에서 닿는다', async ({
        page,
    }) => {
        test.skip(
            test.info().project.name !== 'webkit',
            '모바일 햄버거 메뉴는 webkit(모바일) 프로젝트에서만 실행된다'
        );

        await page.goto('/');
        await settlePwaBanner(page);

        // 닫힌 드로어의 토글은 DOM에 있지만 화면 밖이고, 헤더 줄의 토글은 `display: none`이다 —
        // 가시성 판정 대신 뷰포트 안에 상자가 있는 토글 수를 센다.
        const themeToggles = page.getByRole('button', {
            name: /^테마/,
            includeHidden: true,
        });
        const onScreen = await themeToggles.evaluateAll(
            elements =>
                elements.filter(element => {
                    const rect = element.getBoundingClientRect();
                    return (
                        rect.width > 0 &&
                        rect.right > 0 &&
                        rect.left < window.innerWidth
                    );
                }).length
        );
        expect(onScreen).toBe(0);

        await page.getByRole('button', { name: '메뉴 열기' }).click();
        const drawer = page.getByRole('dialog', { name: '메뉴' });
        await expect(drawer).toBeVisible();
        await expect(
            drawer.getByRole('button', { name: /^테마/ })
        ).toBeVisible();
    });
});
