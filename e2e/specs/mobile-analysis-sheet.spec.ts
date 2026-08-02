import { test, expect } from '../support/fixtures';
import { ANALYSIS_READY_TIMEOUT_MS } from '../support/constants';

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
 * Two more tests guard the P0 this file used to miss entirely: with the
 * sheet mounted and open, guest-reachable inputs OUTSIDE the sheet (header
 * ticker search, floating chatbot) must still accept typing. Before the vaul
 * patch (see MobileAnalysisSheet.tsx), Radix ran modal and its FocusScope
 * yanked focus back into the sheet on every tap into these fields. The
 * member-only holding popover gets the same coverage in the `authed-mobile`
 * project's `mobile-input-reachability.spec.ts`, since it needs a logged-in
 * session this webkit-anon project doesn't have.
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

    test('시트가 열려 있어도 헤더 종목 검색에 타이핑할 수 있다 @webkit', async ({
        page,
    }) => {
        test.skip(
            test.info().project.name !== 'webkit',
            '모바일 분석 시트(MobileAnalysisSheet)는 webkit(모바일)에서만 마운트된다'
        );

        await page.goto(`/${SYMBOL}`);
        await expect(page.locator('[data-vaul-drawer]')).toBeVisible();

        // 사이트 헤더(z-50)는 심볼 헤더(z-40)보다 DOM상 먼저 렌더돼 항상
        // 첫 번째 input이다 — TickerAutocomplete가 실제 combobox를 렌더한다.
        const search = page.locator('header input').first();
        await search.tap();
        await search.fill('TSLA');

        await expect(search).toHaveValue('TSLA');
    });

    test('시트가 열려 있어도 챗봇 입력에 타이핑할 수 있다 @webkit', async ({
        page,
    }) => {
        test.skip(
            test.info().project.name !== 'webkit',
            '모바일 분석 시트(MobileAnalysisSheet)는 webkit(모바일)에서만 마운트된다'
        );

        await page.goto(`/${SYMBOL}`);
        await expect(page.locator('[data-vaul-drawer]')).toBeVisible();

        // FloatingChatButton의 접근 가능한 이름은 'AI 채팅 열기'(닫힌 상태) /
        // 'AI 채팅 닫기'(열린 상태) — symbol-chat.spec.ts에서 검증된 것과 동일하다.
        await page.getByRole('button', { name: 'AI 채팅 열기' }).tap();

        // 챗봇 입력은 분석 진행 애니메이션이 끝나 isAnalysisReady가 true가
        // 될 때까지 disabled다. 활성화를 기다리지 않고 fill()하면 disabled
        // 요소라 액션 자체가 실패한다.
        const chatInput = page.locator('textarea').first();
        await expect(chatInput).toBeEnabled({
            timeout: ANALYSIS_READY_TIMEOUT_MS,
        });

        await chatInput.tap();
        await chatInput.fill('안녕하세요');

        await expect(chatInput).toHaveValue('안녕하세요');
    });
});
