import { test, expect } from '../support/fixtures';

/**
 * 차트 작도(chartOverlays) 드롭다운 — 캐시된 분석 fixture(`e2e/fixtures/analysis.json`)의
 * `technical.chartOverlays` 2건(패턴·추세선)을 헤더 띠의 "차트 작도" 트리거로 켜고 끈다(항목 단위,
 * AI 패널 카드 버튼과 같은 상태). 비로그인 tier에선 추세선이 걸러진다.
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

    // 설계 2026-09-29: on/off는 저장하지 않는다 — 새로고침·새 분석이면 전부 켜진
    // 기본 상태로 돌아간다(예전 localStorage 종류별 영속은 제거됐다).
    test('toggling the 차트 패턴 group turns its items off, and a reload restores the all-on default', async ({
        page,
    }) => {
        await page.goto('/AAPL');
        const trigger = page.getByRole('button', { name: TRIGGER });
        await expect(trigger).toBeVisible({ timeout: 15_000 });
        await trigger.click();

        const panel = page.getByRole('group', { name: TRIGGER });
        const group = panel.getByRole('button', { name: /차트 패턴/ });
        await expect(group).toHaveAttribute('aria-pressed', 'true');
        await group.click();
        await expect(group).toHaveAttribute('aria-pressed', 'false');

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
        ).toHaveAttribute('aria-pressed', 'true');
    });

    // 메뉴와 AI 패널 카드의 "차트에서 보기"는 같은 상태다 — 한쪽에서 끄면 다른 쪽도 꺼진다.
    test('the menu and the AI panel card toggle share one state', async ({
        page,
    }) => {
        await page.goto('/AAPL');
        const cardToggle = page.getByRole('button', {
            name: /차트에서 보기/,
        });
        await expect(cardToggle.first()).toBeVisible({ timeout: 15_000 });
        await expect(cardToggle.first()).toHaveAttribute(
            'aria-pressed',
            'true'
        );

        const trigger = page.getByRole('button', { name: TRIGGER });
        await trigger.click();
        const group = page
            .getByRole('group', { name: TRIGGER })
            .getByRole('button', { name: /차트 패턴/ });
        await group.click();
        await expect(group).toHaveAttribute('aria-pressed', 'false');
        await expect(cardToggle.first()).toHaveAttribute(
            'aria-pressed',
            'false'
        );

        // 패널에서 다시 켜면 메뉴도 켜진다.
        await page.keyboard.press('Escape');
        await cardToggle.first().click();
        await expect(cardToggle.first()).toHaveAttribute(
            'aria-pressed',
            'true'
        );
        await trigger.click();
        await expect(
            page
                .getByRole('group', { name: TRIGGER })
                .getByRole('button', { name: /차트 패턴/ })
        ).toHaveAttribute('aria-pressed', 'true');
    });
});
