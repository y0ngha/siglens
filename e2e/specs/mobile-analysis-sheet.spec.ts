import { test, expect } from '../support/fixtures';

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
 */
const SYMBOL = 'AAPL';
const HANDLE = '[aria-label="AI 분석 패널 크기 조절"]';

// Drag distance: from the PEEK (SNAP_PEEK 0.15) handle, ~400px up on the
// iPhone 14 viewport (844px tall) clears the PEEK→HALF (0.15→0.55) travel
// (~260px) with margin, so vaul settles at HALF/FULL — both well above PEEK.
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
});
