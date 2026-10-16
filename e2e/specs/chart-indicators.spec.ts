import { test, expect } from '../support/fixtures';

/**
 * 차트 보조지표 설정 팝오버 — 헤더 띠 "보조지표" 메뉴 → 카테고리 체크박스/period 칩 → 닫기("차트 작도" 메뉴와 같은 앵커드 팝오버).
 * 데스크톱(chromium)만 실행(@webkit 미태깅): 모바일 시트의 Radix aria-hidden이
 * role 쿼리를 방해하는 이슈를 피한다(symbol-tabs.spec.ts 참조). canvas 반영 대신
 * 모달 UI 흐름을 검증한다 — 차트 데이터에 비의존이라 안정적이다.
 */
test.describe('chart indicator settings popover', () => {
    // 트리거는 글자 메뉴("보조지표" / 켜진 지표가 있으면 "보조지표 · N")라 이름이 바뀐다 — 패널(group) 이름은 고정.
    const TRIGGER = /^보조지표/;
    const PANEL = '보조지표 설정';

    test('opens the popover from the 보조지표 trigger and shows category groups (incl. SMC)', async ({
        page,
    }) => {
        await page.goto('/AAPL');
        const trigger = page.getByRole('button', { name: TRIGGER });
        await expect(trigger).toBeVisible({ timeout: 15_000 });
        await trigger.click();

        const dialog = page.getByRole('group', { name: PANEL });
        await expect(dialog).toBeVisible();
        await expect(dialog.getByText('추세')).toBeVisible();
        await expect(dialog.getByText('모멘텀')).toBeVisible();
        await expect(dialog.getByText('변동성')).toBeVisible();
        await expect(dialog.getByText('볼륨')).toBeVisible();
        // smc 지표 등록으로 'SMC' 카테고리 그룹이 이제 모달에 노출된다(heading으로 'SMC Zones' 체크박스와 구별).
        await expect(
            dialog.getByRole('heading', { name: 'SMC' })
        ).toBeVisible();
    });

    test('toggles the RSI checkbox on', async ({ page }) => {
        await page.goto('/AAPL');
        await page.getByRole('button', { name: TRIGGER }).click();
        // exact: true — 'RSI'와 'StochRSI'가 모두 /RSI/에 매칭돼 strict mode를
        // 위반하므로 정확히 'RSI'만 선택한다.
        const rsi = page
            .getByRole('group', { name: PANEL })
            .getByRole('checkbox', { name: 'RSI', exact: true });
        await rsi.check();
        await expect(rsi).toBeChecked();
    });

    test('selects an MA period chip (aria-pressed)', async ({ page }) => {
        await page.goto('/AAPL');
        await page.getByRole('button', { name: TRIGGER }).click();
        const chip = page
            .getByRole('group', { name: PANEL })
            .getByRole('button', { name: /^20$/ })
            .first();
        await chip.click();
        await expect(chip).toHaveAttribute('aria-pressed', 'true');
    });

    test('closes on Escape', async ({ page }) => {
        await page.goto('/AAPL');
        await page.getByRole('button', { name: TRIGGER }).click();
        await expect(page.getByRole('group', { name: PANEL })).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(page.getByRole('group', { name: PANEL })).toHaveCount(0);
    });

    test('shows the statistical category and toggles MFI into a pane', async ({
        page,
    }) => {
        await page.goto('/AAPL');
        await page.getByRole('button', { name: TRIGGER }).click();
        const dialog = page.getByRole('group', { name: PANEL });
        // hurst/varianceRatio가 'statistical' 카테고리를 등록하므로 '통계' 그룹이 보인다.
        await expect(dialog.getByText('통계')).toBeVisible();
        // MFI는 모멘텀 카테고리의 체크박스(label 'MFI'). exact로 다른 라벨 substring 회피.
        await dialog
            .getByRole('checkbox', { name: 'MFI', exact: true })
            .check();
        await page.keyboard.press('Escape');
        // 페인 라벨('● MFI')은 usePaneLabels가 .pane-indicator-label div로 차트
        // wrapper에 주입한다(role=img canvas의 형제, 그 안이 아님). 이 클래스로
        // 스코프하면 대시보드 SignalBadge('MFI 과매도 반등' 등)와의 substring
        // 충돌도 피한다.
        await expect(
            page.locator('.pane-indicator-label').filter({ hasText: 'MFI' })
        ).toBeVisible();
    });

    test('toggles ATR into a pane via the popover', async ({ page }) => {
        await page.goto('/AAPL');
        await page.getByRole('button', { name: TRIGGER }).click();
        const dialog = page.getByRole('group', { name: PANEL });
        // ATR은 변동성 카테고리의 체크박스(label 'ATR'). exact로 다른 라벨 substring 회피.
        await dialog
            .getByRole('checkbox', { name: 'ATR', exact: true })
            .check();
        await page.keyboard.press('Escape');
        // MFI 케이스와 동일하게 .pane-indicator-label로 스코프 — 대시보드 SignalBadge
        // 등 차트 외부의 'ATR' substring과의 충돌을 피한다.
        await expect(
            page.locator('.pane-indicator-label').filter({ hasText: 'ATR' })
        ).toBeVisible();
    });

    test('toggles Elder Ray into a pane via the popover', async ({ page }) => {
        await page.goto('/AAPL');
        await page.getByRole('button', { name: TRIGGER }).click();
        const dialog = page.getByRole('group', { name: PANEL });
        await dialog
            .getByRole('checkbox', { name: 'Elder Ray', exact: true })
            .check();
        await page.keyboard.press('Escape');
        await expect(
            page
                .locator('.pane-indicator-label')
                .filter({ hasText: 'Bull Power' })
        ).toBeVisible();
    });

    test('toggles Squeeze into a pane via the popover', async ({ page }) => {
        await page.goto('/AAPL');
        await page.getByRole('button', { name: TRIGGER }).click();
        const dialog = page.getByRole('group', { name: PANEL });
        await dialog
            .getByRole('checkbox', { name: 'Squeeze', exact: true })
            .check();
        await page.keyboard.press('Escape');
        await expect(
            page.locator('.pane-indicator-label').filter({ hasText: 'Squeeze' })
        ).toBeVisible();
    });

    test('toggles Regression into a pane via the popover', async ({ page }) => {
        await page.goto('/AAPL');
        await page.getByRole('button', { name: TRIGGER }).click();
        const dialog = page.getByRole('group', { name: PANEL });
        await dialog
            .getByRole('checkbox', { name: 'Regression', exact: true })
            .check();
        await page.keyboard.press('Escape');
        await expect(
            page
                .locator('.pane-indicator-label')
                .filter({ hasText: 'Regression' })
        ).toBeVisible();
    });

    test('toggles the Keltner channel overlay via the popover', async ({
        page,
    }) => {
        await page.goto('/AAPL');
        await page.getByRole('button', { name: TRIGGER }).click();
        const dialog = page.getByRole('group', { name: PANEL });
        // Keltner는 가격 OVERLAY(페인 아님) — OverlayLegend 라벨이 crosshair
        // hover에만 나타나 E2E에서 fragile하다. 안정적인 모달 체크박스 상태로
        // 검증한다. 'Keltner'는 변동성 카테고리 체크박스이며 exact로 substring
        // 충돌을 피한다.
        const keltner = dialog.getByRole('checkbox', {
            name: 'Keltner',
            exact: true,
        });
        await keltner.check();
        await expect(keltner).toBeChecked();
    });

    test('toggles the Supertrend overlay via the popover', async ({ page }) => {
        await page.goto('/AAPL');
        await page.getByRole('button', { name: TRIGGER }).click();
        const dialog = page.getByRole('group', { name: PANEL });
        // Supertrend는 가격 OVERLAY(페인 아님) — Keltner와 동일하게 모달 체크박스
        // 상태로 검증한다. 'Supertrend'는 추세 카테고리 체크박스이며 exact로
        // substring 충돌을 피한다.
        const supertrend = dialog.getByRole('checkbox', {
            name: 'Supertrend',
            exact: true,
        });
        await expect(supertrend).not.toBeChecked();
        await supertrend.check();
        await expect(supertrend).toBeChecked();
    });

    test('toggles the Parabolic SAR overlay via the popover', async ({
        page,
    }) => {
        await page.goto('/AAPL');
        await page.getByRole('button', { name: TRIGGER }).click();
        const dialog = page.getByRole('group', { name: PANEL });
        // Parabolic SAR는 가격 OVERLAY(점 마커) — Keltner/Supertrend와 동일하게
        // 모달 체크박스 상태로 검증한다. exact로 substring 충돌 방지.
        const psar = dialog.getByRole('checkbox', {
            name: 'Parabolic SAR',
            exact: true,
        });
        await expect(psar).not.toBeChecked();
        await psar.check();
        await expect(psar).toBeChecked();
    });

    test('toggles the Chandelier overlay via the popover', async ({ page }) => {
        await page.goto('/AAPL');
        await page.getByRole('button', { name: TRIGGER }).click();
        const dialog = page.getByRole('group', { name: PANEL });
        const chandelier = dialog.getByRole('checkbox', {
            name: 'Chandelier',
            exact: true,
        });
        await expect(chandelier).not.toBeChecked();
        await chandelier.check();
        await expect(chandelier).toBeChecked();
    });

    test('toggles the Elder Impulse candle paint via the popover', async ({
        page,
    }) => {
        await page.goto('/AAPL');
        await page.getByRole('button', { name: TRIGGER }).click();
        const dialog = page.getByRole('group', { name: PANEL });
        // Elder Impulse는 메인 캔들을 재색칠(candle-paint) — pane/overlay 라벨이 없어
        // 모달 체크박스 상태로 검증한다. exact로 substring 충돌 방지.
        const impulse = dialog.getByRole('checkbox', {
            name: 'Elder Impulse',
            exact: true,
        });
        await expect(impulse).not.toBeChecked();
        await impulse.check();
        await expect(impulse).toBeChecked();
    });

    test('toggles SMC Zones via the popover', async ({ page }) => {
        await page.goto('/AAPL');
        await page.getByRole('button', { name: TRIGGER }).click();
        const dialog = page.getByRole('group', { name: PANEL });
        // SMC Zones는 가격선(zone) — pane/overlay 라벨이 없어 모달 체크박스 상태로 검증.
        // smc 등록으로 'SMC' 카테고리 그룹이 모달에 처음 노출된다('SMC Zones' 스팬과 구별 위해 heading).
        await expect(
            dialog.getByRole('heading', { name: 'SMC' })
        ).toBeVisible();
        const smc = dialog.getByRole('checkbox', {
            name: 'SMC Zones',
            exact: true,
        });
        await expect(smc).not.toBeChecked();
        await smc.check();
        await expect(smc).toBeChecked();
    });

    test('the gear is the chart settings menu, and only one header menu is open at a time', async ({
        page,
    }) => {
        await page.goto('/AAPL');
        const trigger = page.getByRole('button', { name: TRIGGER });
        await expect(trigger).toBeVisible({ timeout: 15_000 });
        await trigger.click();
        await expect(page.getByRole('group', { name: PANEL })).toBeVisible();

        await page.getByRole('button', { name: '차트 설정' }).click();
        await expect(
            page.getByRole('group', { name: '차트 설정' })
        ).toBeVisible();
        // 하나를 열면 나머지는 닫힌다.
        await expect(page.getByRole('group', { name: PANEL })).toHaveCount(0);
        // 시간외 거래 행은 이 메뉴에 있다(적용 여부와 무관하게 항상 보인다).
        await expect(
            page.getByRole('group', { name: '차트 설정' }).getByRole('button', {
                name: /시간외 거래\(프리·애프터마켓\) 표시/,
            })
        ).toBeVisible();
    });
});
