import { test, expect } from '../support/fixtures';

/**
 * Backtesting showcase (`/backtesting`) — Tier 3 render outcome.
 *
 * A static results-showcase page. Its hero h1 ("AI 분석을 2년 동안 그대로 따랐다면",
 * BacktestHero) is the stable marker — NOT the sample analysis
 * narratives (RSI/pattern copy), which are illustrative content. Asserting the
 * h1 proves the route renders inside its semantic <main> landmark.
 */
test.describe('backtesting showcase', () => {
    test('renders the backtest hero heading', async ({ page }) => {
        await page.goto('/backtesting');

        await expect(
            page.getByRole('heading', {
                level: 1,
                name: /AI 분석을 \d+년 동안 그대로 따랐다면/,
            })
        ).toBeVisible();
    });

    // 수익률 옆에 보유 기준선이 함께 있다. 옛 화면(AI 전략 결과만)에서는 이 표 제목도 열도
    // 없어서 실패한다.
    test('shows the hold baselines next to the returns', async ({ page }) => {
        await page.goto('/backtesting');

        await expect(
            page.getByRole('heading', { level: 2, name: '보유 전략과 비교' })
        ).toBeVisible();
        await expect(
            page
                .getByRole('region', { name: '보유 전략과 비교 표' })
                .getByRole('columnheader')
        ).toHaveText([
            '종목',
            '매매',
            '승률',
            'AI 전략',
            '최대 낙폭 (매일 평가)',
            '투자 비중',
            '계속 보유',
            '비중 맞춘 보유',
            '보유 시 최대 낙폭',
        ]);
        await expect(
            page.getByText(/같은 \d+종목을 계속 들고 있었다면/)
        ).toBeVisible();
        await expect(
            page.getByText(
                /기간 중 어느 날에 사든 같은 날수만큼 들고 있었을 때의 평균과 비교하면/
            )
        ).toBeVisible();
        await expect(
            page.getByRole('heading', { level: 2, name: '진입 시점의 효과' })
        ).toBeVisible();
    });
});
