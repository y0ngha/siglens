import { test, expect } from '../support/fixtures';

/**
 * Backtesting showcase (`/backtesting`) — Tier 3 render outcome.
 *
 * A static results-showcase page. Its hero h1 ("Siglens가 얼마나 정확한가요?",
 * BacktestHero) is the stable, data-independent marker — NOT the sample analysis
 * narratives (RSI/pattern copy), which are illustrative content. Asserting the
 * h1 proves the route renders inside its semantic <main> landmark.
 */
test.describe('backtesting showcase', () => {
    test('renders the backtest hero heading', async ({ page }) => {
        await page.goto('/backtesting');

        await expect(
            page.getByRole('heading', {
                level: 1,
                name: 'Siglens가 얼마나 정확한가요?',
            })
        ).toBeVisible();
    });
});
