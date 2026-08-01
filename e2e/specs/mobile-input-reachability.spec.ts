import { test, expect } from '../support/fixtures';

/**
 * 모바일 차트 페이지에서 분석 바텀시트가 마운트된 상태로도 시트 **밖** UI가
 * 정상 동작하는지 고정한다.
 *
 * 회귀 배경: vaul 1.1.2가 `modal={false}`를 내부 Radix Dialog에 전달하지 않아
 * Radix가 modal 모드로 돌았고, FocusScope가 시트 밖 입력의 포커스를 즉시
 * 되돌려 평단 팝오버·헤더 검색·챗봇 입력이 전부 먹통이었다.
 * `.yarn/patches`의 vaul 패치가 그 passthrough를 복구한다.
 *
 * 비회원도 닿는 헤더 검색·챗봇은 `mobile-analysis-sheet.spec.ts`가 맡고,
 * 여기서는 로그인이 필요한 평단 팝오버와 레이아웃 불변식만 검사한다.
 */
test.describe('모바일 차트 페이지 입력 도달성 (authed, 시트 마운트 상태)', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/AAPL');
        // 시트는 rAF + 50ms 뒤에 열린다. 열리기 전에 단언하면 공허하게 통과한다.
        await expect(page.locator('[data-vaul-drawer]')).toBeVisible();
    });

    test('평단 팝오버의 수량·평단 입력에 실제로 타이핑할 수 있다', async ({
        page,
    }) => {
        await page.getByRole('button', { name: /평단/ }).first().tap();

        const dialog = page.getByRole('dialog', { name: /AAPL 평단 설정/ });
        await expect(dialog).toBeVisible();

        const quantity = dialog.getByLabel('수량');
        const averagePrice = dialog.getByLabel('평단');

        // 회귀 고정: PopoverSurface가 내부에서 useIsMobileViewport()를 읽던
        // 시절에는 마운트 직후 Fragment→Portal로 fiber 타입이 바뀌며 패널
        // 서브트리가 remount돼 focus trap의 초기 포커스가 무효화됐다(포커스가
        // body에 남음). isMobile을 프롭으로 끌어올린 지금은 첫 커밋부터
        // 값이 확정돼 있어 트랩이 그대로 살아남는다 — 시트 열림 애니메이션과
        // 겹칠 수 있어 toPass()로 재시도한다.
        await expect(async () => {
            await expect(quantity).toBeFocused();
        }).toPass();

        await quantity.tap();
        await quantity.fill('12');
        await averagePrice.tap();
        await averagePrice.fill('321.5');

        // 값이 실제로 반영돼야 한다 — 포커스를 빼앗기면 빈 문자열로 남는다.
        await expect(quantity).toHaveValue('12');
        await expect(averagePrice).toHaveValue('321.5');
    });

    test('평단 팝오버가 뷰포트 안에 완전히 들어온다', async ({ page }) => {
        await page.getByRole('button', { name: /평단/ }).first().tap();

        const dialog = page.getByRole('dialog', { name: /AAPL 평단 설정/ });
        await expect(dialog).toBeVisible();

        await expect(async () => {
            const box = await dialog.boundingBox();
            const viewport = page.viewportSize();
            expect(box).not.toBeNull();
            expect(viewport).not.toBeNull();
            if (box === null || viewport === null) return;

            expect(box.x).toBeGreaterThanOrEqual(0);
            expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
            expect(box.y).toBeGreaterThanOrEqual(0);
        }).toPass();
    });

    test('평단 팝오버가 분석 시트에 가려지지 않는다', async ({ page }) => {
        await page.getByRole('button', { name: /평단/ }).first().tap();

        const dialog = page.getByRole('dialog', { name: /AAPL 평단 설정/ });
        await expect(dialog).toBeVisible();

        // B4(감사): 이전에는 `el.closest('header') === null`("body로
        // 포털됐다")만 확인했다 — 이건 z-index 합성 순서와 무관한 신호라,
        // z-60을 z-40으로 낮춰 실제로 시트 아래에 깔려도 이 단언은 여전히
        // 참이었다(포털은 됐지만 가려짐). 실제로 중요한 건 다이얼로그
        // 중심점에서 elementFromPoint가 실제로 다이얼로그(또는 그 후손)를
        // 되돌리는지다 — 뭔가가 그 위에 그려져 있으면 그 뭔가가 대신
        // 잡힌다.
        await expect(async () => {
            const box = await dialog.boundingBox();
            expect(box).not.toBeNull();
            if (box === null) return;

            const centerX = box.x + box.width / 2;
            const centerY = box.y + box.height / 2;
            const isOnTop = await page.evaluate(
                ({ x, y }) => {
                    const el = document.elementFromPoint(x, y);
                    const dialogEl = document.querySelector('[role="dialog"]');
                    return (
                        el !== null &&
                        dialogEl !== null &&
                        dialogEl.contains(el)
                    );
                },
                { x: centerX, y: centerY }
            );
            expect(isOnTop).toBe(true);
        }).toPass({ timeout: 15_000 });
    });

    test('시트 밖 앱 트리에 aria-hidden이 붙지 않는다', async ({ page }) => {
        const headerAriaHidden = await page
            .locator('header')
            .first()
            .getAttribute('aria-hidden');

        expect(headerAriaHidden).toBeNull();
    });

    test('초기 스냅에서 캔들·거래량 차트가 시트에 가려지지 않는다', async ({
        page,
    }) => {
        const sheet = page.locator('[data-vaul-drawer]');
        const candles = page.getByRole('img', { name: /캔들 차트/ });
        const volume = page.getByRole('img', { name: /거래량 차트/ });

        // vaul의 스냅 애니메이션이 끝날 때까지 재시도한다.
        await expect(async () => {
            const sheetBox = await sheet.boundingBox();
            expect(sheetBox).not.toBeNull();
            if (sheetBox === null) return;

            for (const chart of [candles, volume]) {
                const chartBox = await chart.boundingBox();
                expect(chartBox).not.toBeNull();
                if (chartBox === null) return;
                expect(chartBox.y + chartBox.height).toBeLessThanOrEqual(
                    sheetBox.y
                );
            }
        }).toPass();
    });
});
