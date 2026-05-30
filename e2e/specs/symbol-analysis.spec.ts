import { test, expect } from '../support/fixtures';

/**
 * End-to-end validation of the analysis short-circuit infra (Tasks A/B).
 *
 * Under E2E_TEST=1 the submit actions short-circuit to a fixed cached fixture
 * (`e2e/fixtures/analysis.json` via `e2eCachedTechnical()`), so the chart page's
 * AI analysis renders from that fixture with no worker/LLM round-trip and no
 * external browser request (the support/fixtures network guard enforces zero).
 *
 * Render path (verified against the real DOM, not the integration-test mocks):
 *   - The SSR page (`app/[symbol]/page.tsx`) does NOT go through the submit
 *     short-circuit — it calls read-only `peekAnalysisCache`, which misses under
 *     E2E, so `initialAnalysis = FALLBACK_ANALYSIS`. The page always passes
 *     `initialAnalysisFailed={true}`, so on client mount `useAnalysis` auto-runs
 *     `submitAnalysisAction(force=false)`, which under E2E returns
 *     `{ status: 'cached', result: <fixture.technical> }`. `setAnalysisResult`
 *     then swaps `analysis` to the fixture (a fresh object, so
 *     `isFallbackAnalysis` is false) and `ChartContent` renders the real
 *     `AnalysisPanel` branch instead of the `TechnicalFactsSummary` placeholder.
 *   - `AnalysisPanel` hides the `summary` while the progress-finishing animation
 *     runs (`showProgress`/`displayAnalyzing`). That animation uses real
 *     `setTimeout`s (~3.5s hold + 5×1s phase steps + 0.6s tail ≈ 9s), after
 *     which `handleProgressFinished` flips `displayAnalyzing` to false and the
 *     fixture `summary` renders via `MarkdownText`. We therefore assert the
 *     summary with an extended timeout and do NOT freeze the clock (a frozen
 *     clock would stall those timers and the summary would never appear).
 *   - The analysis lives in the desktop `<aside>` (`md:flex`, hidden on mobile);
 *     Desktop Chrome's default 1280px viewport keeps it visible, so we never
 *     need the mobile bottom-sheet path here.
 *
 * Fixture anchors asserted on:
 *   - `fixture.technical.summary` starts with "E2E 고정 분석 결과" — a stable
 *     literal that only appears once the fixture-backed analysis renders.
 */

const ANALYSIS_FIXTURE_SUMMARY_PREFIX = 'E2E 고정 분석 결과';

// 진행 마무리 애니메이션(~9s)이 끝난 뒤에야 summary가 드러나므로 넉넉히 잡는다.
const ANALYSIS_RENDER_TIMEOUT_MS = 20_000;

test.describe('symbol analysis: cached-fixture short-circuit renders', () => {
    test('renders the AI analysis from the cached fixture', async ({
        page,
    }) => {
        await page.goto('/AAPL');

        // The fixture's technical summary text only renders once the cached
        // short-circuit has replaced FALLBACK_ANALYSIS with the fixture and the
        // progress-finishing animation has elapsed — its presence proves the
        // submit short-circuit fired and the deterministic fixture (not a
        // placeholder / real LLM output) drove the render. Scope to the desktop
        // analysis aside (role="complementary") so the off-screen mobile-sheet
        // copy of the same text never triggers a strict-mode violation.
        await expect(
            page
                .getByRole('complementary')
                .getByText(ANALYSIS_FIXTURE_SUMMARY_PREFIX, { exact: false })
        ).toBeVisible({ timeout: ANALYSIS_RENDER_TIMEOUT_MS });
    });

    test('timeframe change keeps the fixture analysis rendered', async ({
        page,
    }) => {
        await page.goto('/AAPL');

        // Wait for the initial cached fixture to render before switching.
        // Scope to the desktop analysis aside so the off-screen mobile-sheet
        // copy of the same summary cannot trip a strict-mode violation.
        const fixtureSummary = page
            .getByRole('complementary')
            .getByText(ANALYSIS_FIXTURE_SUMMARY_PREFIX, { exact: false });
        await expect(fixtureSummary).toBeVisible({
            timeout: ANALYSIS_RENDER_TIMEOUT_MS,
        });

        // Default timeframe is 1Day; switch to 1Hour via the TimeframeSelector.
        const oneHourButton = page.getByRole('button', { name: '1시간' });
        await oneHourButton.click();

        // The change is reflected in the URL (?tf=1Hour) — a meaningful,
        // user-visible outcome of the timeframe switch.
        await page.waitForURL('**/AAPL?tf=1Hour');

        // The 1Hour button is now the active one (primary border/text color).
        await expect(oneHourButton).toHaveClass(/primary/);

        // The timeframe change re-runs the cached short-circuit, so the fixture
        // analysis must still be rendered afterwards (not stuck loading/blank).
        await expect(fixtureSummary).toBeVisible({
            timeout: ANALYSIS_RENDER_TIMEOUT_MS,
        });
    });
});
