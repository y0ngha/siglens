import { test, expect } from '../support/fixtures';

/**
 * Mobile nav drawer (`@webkit`) — HeaderMobileMenu hydration + interaction guard.
 *
 * `HeaderMobileMenu` is a `'use client'` component rendered inside `md:hidden`,
 * so it only appears on mobile viewports (< md 768px). The webkit project uses
 * `devices['iPhone 14']` (~390px), so the hamburger renders there.
 *
 * The tests act as a hydration guard: a dead / un-hydrated button leaves the
 * drawer `aria-hidden="true"` permanently — so `getByRole('dialog', {name:'메뉴'})`
 * would never become visible. A real click that opens the drawer proves React
 * hydration ran successfully on the client.
 *
 * The drawer is always in the DOM (SSR: crawlers see the nav links), but:
 *   - Closed: `aria-hidden="true"` + `translate-x-full` → hidden from AT and off-screen.
 *   - Open:   `aria-hidden` removed + `translate-x-0` → in AT, on-screen.
 *
 * For open-state assertions we use `getByRole('dialog', {name:'메뉴'})` which is
 * excluded by aria-hidden when closed.
 * For closed-state assertions after an interaction we use the raw `[role="dialog"]`
 * locator and assert `toHaveAttribute('aria-hidden', 'true')` so the check is
 * independent of CSS geometry.
 */

/** Raw locator for the drawer — works regardless of aria-hidden state. */
const drawerSelector = '[role="dialog"][aria-label="메뉴"]';

test.describe('@webkit 모바일 햄버거 내비게이션', () => {
    /**
     * 1. 햄버거 클릭 시 드로어가 실제로 열린다.
     *
     * Proves hydration ran: a static (un-hydrated) button cannot toggle state,
     * so `role="dialog"` stays aria-hidden and `getByRole` would time out.
     */
    test('@webkit 햄버거 클릭 시 드로어가 실제로 열린다', async ({ page }) => {
        test.skip(
            test.info().project.name !== 'webkit',
            '모바일 햄버거 메뉴는 webkit(모바일) 프로젝트에서만 실행된다'
        );

        await page.goto('/');

        // 트리거 — 초기 상태: '메뉴 열기' 레이블, aria-expanded=false.
        const trigger = page.getByRole('button', { name: '메뉴 열기' });
        await expect(trigger).toBeVisible();
        await expect(trigger).toHaveAttribute('aria-expanded', 'false');

        // 햄버거 클릭 → 드로어 열림.
        await trigger.click();

        // 드로어가 접근성 트리에 노출됨 (aria-hidden 제거 + aria-modal=true).
        const drawer = page.getByRole('dialog', { name: '메뉴' });
        await expect(drawer).toBeVisible();

        // 트리거 레이블이 '메뉴 닫기'로 전환되고 aria-expanded=true.
        const closeLabel = page.getByRole('button', { name: '메뉴 닫기' });
        await expect(closeLabel).toBeVisible();
        await expect(closeLabel).toHaveAttribute('aria-expanded', 'true');

        // 드로어 내부에 '미국 경제' → /economy 링크가 있다 (헤더/푸터 사본 방지를 위해 드로어로 범위 제한).
        await expect(
            drawer
                .getByRole('navigation', { name: '메뉴' })
                .getByRole('link', { name: '미국 경제' })
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

        // 열기.
        await page.getByRole('button', { name: '메뉴 열기' }).click();
        await expect(page.getByRole('dialog', { name: '메뉴' })).toBeVisible();

        // 토글 — 같은 버튼이 이제 '메뉴 닫기' 레이블.
        await page.getByRole('button', { name: '메뉴 닫기' }).click();

        // 드로어가 접근성 트리에서 숨겨짐 (aria-hidden=true 복귀).
        await expect(page.locator(drawerSelector)).toHaveAttribute(
            'aria-hidden',
            'true'
        );
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

        // 열기.
        await page.getByRole('button', { name: '메뉴 열기' }).click();
        await expect(page.getByRole('dialog', { name: '메뉴' })).toBeVisible();

        // Escape → 드로어 닫힘.
        await page.keyboard.press('Escape');

        await expect(page.locator(drawerSelector)).toHaveAttribute(
            'aria-hidden',
            'true'
        );

        // useEscapeKey의 close 콜백이 triggerRef.current?.focus()를 호출하므로
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

        // 열기.
        await page.getByRole('button', { name: '메뉴 열기' }).click();
        const drawer = page.getByRole('dialog', { name: '메뉴' });
        await expect(drawer).toBeVisible();

        // 드로어 내부 '미국 경제' 링크를 클릭한다.
        // Link의 onClick={close} 핸들러가 탐색 전에 드로어를 닫는다.
        await drawer
            .getByRole('navigation', { name: '메뉴' })
            .getByRole('link', { name: '미국 경제' })
            .click();

        await page.waitForURL('**/economy');

        // 이동 후 드로어가 닫혀 있어야 한다.
        await expect(page.locator(drawerSelector)).toHaveAttribute(
            'aria-hidden',
            'true'
        );
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

        // (a) 백드롭 클릭으로 닫기.
        await page.getByRole('button', { name: '메뉴 열기' }).click();
        await expect(page.getByRole('dialog', { name: '메뉴' })).toBeVisible();

        await page.locator('[data-testid="mobile-nav-backdrop"]').click();

        await expect(page.locator(drawerSelector)).toHaveAttribute(
            'aria-hidden',
            'true'
        );

        // (b) X 버튼('메뉴 패널 닫기')으로 닫기.
        await page.getByRole('button', { name: '메뉴 열기' }).click();
        await expect(page.getByRole('dialog', { name: '메뉴' })).toBeVisible();

        await page.getByRole('button', { name: '메뉴 패널 닫기' }).click();

        await expect(page.locator(drawerSelector)).toHaveAttribute(
            'aria-hidden',
            'true'
        );
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
});
