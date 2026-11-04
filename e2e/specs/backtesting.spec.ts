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
});
