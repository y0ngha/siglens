import { test, expect } from '../support/fixtures';

/**
 * 차트 보조지표 설정 모달 — 우상단 톱니바퀴 → 카테고리 체크박스/period 칩 → 닫기.
 * 데스크톱(chromium)만 실행(@webkit 미태깅): 모바일 시트의 Radix aria-hidden이
 * role 쿼리를 방해하는 이슈를 피한다(symbol-tabs.spec.ts 참조). canvas 반영 대신
 * 모달 UI 흐름을 검증한다 — 차트 데이터에 비의존이라 안정적이다.
 */
test.describe('chart indicator settings modal', () => {
    const GEAR = '보조지표 설정';

    test('opens the modal from the gear and shows category groups (no SMC)', async ({
        page,
    }) => {
        await page.goto('/AAPL');
        const gear = page.getByRole('button', { name: GEAR });
        await expect(gear).toBeVisible({ timeout: 15_000 });
        await gear.click();

        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();
        await expect(dialog.getByText('추세')).toBeVisible();
        await expect(dialog.getByText('모멘텀')).toBeVisible();
        await expect(dialog.getByText('변동성')).toBeVisible();
        await expect(dialog.getByText('볼륨')).toBeVisible();
        await expect(dialog.getByText('SMC')).toHaveCount(0);
    });

    test('toggles the RSI checkbox on', async ({ page }) => {
        await page.goto('/AAPL');
        await page.getByRole('button', { name: GEAR }).click();
        // exact: true — 'RSI'와 'StochRSI'가 모두 /RSI/에 매칭돼 strict mode를
        // 위반하므로 정확히 'RSI'만 선택한다.
        const rsi = page
            .getByRole('dialog')
            .getByRole('checkbox', { name: 'RSI', exact: true });
        await rsi.check();
        await expect(rsi).toBeChecked();
    });

    test('selects an MA period chip (aria-pressed)', async ({ page }) => {
        await page.goto('/AAPL');
        await page.getByRole('button', { name: GEAR }).click();
        const chip = page
            .getByRole('dialog')
            .getByRole('button', { name: /^20$/ })
            .first();
        await chip.click();
        await expect(chip).toHaveAttribute('aria-pressed', 'true');
    });

    test('closes on Escape', async ({ page }) => {
        await page.goto('/AAPL');
        await page.getByRole('button', { name: GEAR }).click();
        await expect(page.getByRole('dialog')).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(page.getByRole('dialog')).toHaveCount(0);
    });
});
