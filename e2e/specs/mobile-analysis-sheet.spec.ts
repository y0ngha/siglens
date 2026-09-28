import { test, expect } from '../support/fixtures';
import { settlePwaBanner } from '../support/pwaBanner';

/**
 * Mobile analysis bottom sheet (`@webkit`) — Tier 3 mobile interaction.
 *
 * The chart route (`/[symbol]`) mounts `MobileAnalysisSheet` (a vaul drawer,
 * always-open / `dismissible={false}`) ONLY on mobile; desktop chromium renders
 * the `<aside>` panel instead. So this is webkit-only and self-skips elsewhere.
 *
 * Snap behavior is covered at two complementary levels: the snap-DECISION
 * logic by the `useMobileAnalysisSheet` unit test (isFullSnap, peek-reopen),
 * and the real vaul drag INTERACTION here — the only place a real touch-drag
 * against the live drawer actually runs. This test:
 *   - asserts the sheet mounts (the vaul drag handle is present), and
 *   - drags the handle upward and asserts the sheet expands (its handle ends
 *     visibly higher on screen than at the collapsed PEEK snap).
 *
 * One more test guards the P0 this file used to miss entirely: with the
 * sheet mounted and open, a guest-reachable input OUTSIDE the sheet (the
 * full-screen search overlay behind the header's magnifier) must still
 * accept typing. Before the vaul patch (see MobileAnalysisSheet.tsx), Radix
 * ran modal and its FocusScope yanked focus back into the sheet on every tap
 * into that field. The member-only holding popover gets the same coverage in
 * the `authed-mobile` project's `mobile-input-reachability.spec.ts`, since it
 * needs a logged-in session this webkit-anon project doesn't have.
 */
const SYMBOL = 'AAPL';
const HANDLE = '[aria-label="AI 분석 패널 크기 조절"]';

// Drag distance: from the PEEK (SNAP_PEEK 0.20) handle, ~400px up on the
// iPhone 14 viewport (844px tall) clears the PEEK→HALF (0.20→0.55) travel
// (~295px) with margin, so vaul settles at HALF/FULL — both well above PEEK.
const DRAG_UP_PX = 400;
// Expansion is asserted by a robust position delta, NOT an exact snap pixel:
// the handle must end at least this much higher than its collapsed PEEK Y.
const MIN_EXPAND_DELTA_PX = 50;

test.describe('@webkit mobile analysis sheet', () => {
    test('@webkit bottom sheet mounts and drags up to expand', async ({
        page,
    }) => {
        test.skip(
            test.info().project.name !== 'webkit',
            '모바일 분석 시트(MobileAnalysisSheet)는 webkit(모바일)에서만 마운트된다'
        );

        await page.goto(`/${SYMBOL}`);
        // 첫 입력을 미리 소진한다 — 안 그러면 첫 탭·드래그가 PWA 배너를 띄워
        // 제스처 도중에 헤더가 밀린다(`settlePwaBanner` JSDoc).
        await settlePwaBanner(page);

        // The vaul drag handle proves the MobileAnalysisSheet mounted on mobile.
        const handle = page.locator(HANDLE);
        await expect(handle).toBeVisible();

        const collapsed = await handle.boundingBox();
        expect(collapsed).not.toBeNull();

        // Drag the handle upward to snap the sheet to a higher point. We drive
        // it with page.mouse, NOT a touch primitive: vaul is built on Pointer
        // Events, which page.mouse generates (pointerType 'mouse'); vaul's snap
        // logic is position/velocity based and treats them identically to touch.
        // This is also the only practical drag primitive here — page.touchscreen
        // only taps, and CDP Input.dispatchTouchEvent is Chromium-only, so it is
        // unavailable in this webkit-only test. Do NOT "fix" this to touch.
        const cx = collapsed!.x + collapsed!.width / 2;
        const cy = collapsed!.y + collapsed!.height / 2;
        await page.mouse.move(cx, cy);
        await page.mouse.down();
        await page.mouse.move(cx, cy - DRAG_UP_PX, { steps: 12 });
        await page.mouse.up();

        // The sheet expanded: its handle settles visibly higher than at PEEK.
        // toPass retries while the vaul snap animation settles.
        await expect(async () => {
            const expanded = await handle.boundingBox();
            expect(expanded).not.toBeNull();
            expect(expanded!.y).toBeLessThan(
                collapsed!.y - MIN_EXPAND_DELTA_PX
            );
        }).toPass({ timeout: 5_000 });
    });

    test('시트가 열려 있어도 헤더 종목 검색에 타이핑할 수 있다 @webkit', async ({
        page,
    }) => {
        test.skip(
            test.info().project.name !== 'webkit',
            '모바일 분석 시트(MobileAnalysisSheet)는 webkit(모바일)에서만 마운트된다'
        );

        await page.goto(`/${SYMBOL}`);
        // 첫 입력을 미리 소진한다 — 안 그러면 첫 탭·드래그가 PWA 배너를 띄워
        // 제스처 도중에 헤더가 밀린다(`settlePwaBanner` JSDoc).
        await settlePwaBanner(page);
        await expect(page.locator('[data-vaul-drawer]')).toBeVisible();

        // 모바일(`lg` 미만)에서 헤더의 검색 표면은 인라인 입력이 아니라 돋보기
        // 트리거다 — 탭하면 전체화면 오버레이가 열린다. 지켜야 할 불변식은 그대로다:
        // vaul 시트가 열려 있어도 **시트 밖 입력**이 포커스를 받고 타이핑돼야 한다.
        await page.getByRole('button', { name: '종목 검색 열기' }).tap();

        const search = page.getByRole('searchbox', {
            name: '종목명 · 티커 검색',
        });
        await expect(search).toBeFocused();
        await search.fill('TSLA');

        await expect(search).toHaveValue('TSLA');
    });
});
