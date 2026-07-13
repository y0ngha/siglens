import { test, expect } from '../support/fixtures';
import {
    ANALYSIS_FIXTURE_SUMMARY_PREFIX,
    ANALYSIS_RENDER_TIMEOUT_MS,
} from '../support/constants';
import { signupThrowawayUser } from '../support/signupThrowawayUser';

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

test.describe('symbol analysis: cached-fixture short-circuit renders', () => {
    test.describe.configure({ timeout: 60_000 });

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

    test('free deep links are canonicalized to daily and intraday controls are disabled', async ({
        page,
    }) => {
        await page.goto('/AAPL?tf=1Hour');

        await page.waitForURL('**/AAPL?tf=1Day');
        await expect(page.getByRole('button', { name: '5분' })).toBeDisabled();
        await expect(
            page.getByRole('button', { name: '1시간' })
        ).toBeDisabled();
        await expect(
            page
                .getByRole('complementary')
                .getByRole('link', { name: '회원가입' })
        ).toBeVisible({ timeout: ANALYSIS_RENDER_TIMEOUT_MS });
    });

    test('new member may retain a direct minute-timeframe URL', async ({
        page,
    }) => {
        await signupThrowawayUser(
            page,
            `e2e-tier-member-${Date.now()}@test.com`,
            'E2eTierMember1!'
        );

        await page.goto('/AAPL?tf=5Min');

        await expect(page.getByRole('button', { name: '5분' })).toBeEnabled();
        await page.waitForURL('**/AAPL?tf=5Min');
        await expect(page.getByRole('button', { name: '5분' })).toHaveClass(
            /primary/
        );
    });
});
