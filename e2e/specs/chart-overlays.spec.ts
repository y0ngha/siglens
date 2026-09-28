import { test, expect } from '../support/fixtures';

/**
 * 차트 작도(chartOverlays) 드롭다운 — 캐시된 분석 fixture(`e2e/fixtures/analysis.json`)의
 * `technical.chartOverlays` 2건(패턴·추세선)을 헤더 띠의 "차트 작도" 트리거로 켜고 끈다. 비로그인 tier에선 추세선이 걸러진다.
 * `chart-indicators.spec.ts`와 동일하게 데스크톱(chromium)만 대상으로 모달 UI 흐름을
 * 검증한다 — 실제 차트 canvas 렌더 대신 안정적인 드롭다운 상태로 확인한다.
 */
test.describe('chart overlays menu', () => {
    const TRIGGER = /차트 작도/;

    test('shows the 차트 작도 trigger in the chart header once the cached analysis loads', async ({
        page,
    }) => {
        await page.goto('/AAPL');
        const trigger = page.getByRole('button', { name: TRIGGER });
        await expect(trigger).toBeVisible({ timeout: 15_000 });
    });

    // 비로그인(free) tier는 `full_detail`이 없어 추세선 오버레이가 core
    // filterAnalysisResult에서 걸러진다 — 메뉴에는 차트 패턴만 남아야 한다.
    test('opens the panel: 차트 패턴 pressed by default, 추세선 hidden for the anonymous tier', async ({
        page,
    }) => {
        await page.goto('/AAPL');
        const trigger = page.getByRole('button', { name: TRIGGER });
        await expect(trigger).toBeVisible({ timeout: 15_000 });
        await trigger.click();

        const panel = page.getByRole('group', { name: TRIGGER });
        await expect(panel).toBeVisible();

        // 트리거의 접근 가능한 이름도 `/차트 작도/`와 매칭되므로 panel로 scope한다.
        const pattern = panel.getByRole('button', { name: /차트 패턴/ });
        const trendline = panel.getByRole('button', { name: /추세선/ });
        await expect(pattern).toBeVisible();
        await expect(pattern).toHaveAttribute('aria-pressed', 'true');
        await expect(trendline).toHaveCount(0);
    });

    test('toggling 차트 패턴 flips aria-pressed and persists after reload', async ({
        page,
    }) => {
        await page.goto('/AAPL');
        const trigger = page.getByRole('button', { name: TRIGGER });
        await expect(trigger).toBeVisible({ timeout: 15_000 });
        await trigger.click();

        const pattern = page
            .getByRole('group', { name: TRIGGER })
            .getByRole('button', { name: /차트 패턴/ });
        await expect(pattern).toHaveAttribute('aria-pressed', 'true');
        await pattern.click();
        await expect(pattern).toHaveAttribute('aria-pressed', 'false');

        await page.reload();
        const triggerAfterReload = page.getByRole('button', {
            name: TRIGGER,
        });
        await expect(triggerAfterReload).toBeVisible({ timeout: 15_000 });
        await triggerAfterReload.click();
        await expect(
            page
                .getByRole('group', { name: TRIGGER })
                .getByRole('button', { name: /차트 패턴/ })
        ).toHaveAttribute('aria-pressed', 'false');
    });
});
