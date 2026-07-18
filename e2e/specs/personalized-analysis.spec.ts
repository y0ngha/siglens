import { test, expect } from '../support/fixtures';
import type { Locator, Page } from '@playwright/test';
import {
    ANALYSIS_FIXTURE_SUMMARY_PREFIX,
    ANALYSIS_RENDER_TIMEOUT_MS,
} from '../support/constants';

/**
 * Authed spec — exercises the "내 평단 기준으로 분석했어요" personalized-analysis
 * transparency badge (`src/widgets/analysis/AnalysisPanel.tsx`'s
 * `PersonalizedAnalysisBadge`, `data-testid="personalized-analysis-badge"`,
 * personalized-analysis-by-position-bucket spec, Subsystem C). It renders ONLY
 * when `tier !== 'free' && holding != null && !isFallbackAnalysis(analysis)`
 * (the exact gate read off `AnalysisPanel.tsx`).
 *
 * FEASIBILITY (the load-bearing question for this spec — both legs check out):
 *
 * 1. Tier: `users.tier` (`src/shared/db/schema.ts`) defaults to `'member'`,
 *    and `e2e/setup/seed.ts` upserts the authed E2E user (`AUTH_USER_EMAIL`)
 *    with no explicit `tier` override, so it lands on `'member'` — which
 *    clears the `tier !== 'free'` half of the gate. Both the server
 *    (`resolveTierOnly` → `getUserTier` reads the same DB row) and the client
 *    (`useSymbolModel`'s tier, threaded into `AnalysisPanel`'s `tier` prop via
 *    `ChartContent.tsx`) resolve the identical value, so there is no
 *    server/client tier mismatch to worry about.
 *
 * 2. Non-fallback analysis: `submitAnalysisAction`'s `isE2E()` short-circuit
 *    (`src/entities/analysis/actions/submitAnalysisAction.ts`) returns
 *    `e2eCachedTechnical(tier)`, which is `filterAnalysisResult(fixture.technical,
 *    tier)` — a real fixture-shaped `AnalysisResponse`
 *    (`e2e/fixtures/analysis.json`'s `technical` key: summary "E2E 고정 분석
 *    결과: ...", `indicatorResults.length === 1`), NOT the `FALLBACK_ANALYSIS`
 *    placeholder (`src/entities/chat-message/lib/fallbackAnalysis.ts`, sentinel
 *    summary "AI 분석을 일시적으로 사용할 수 없습니다." + all-empty arrays).
 *    `isFallbackAnalysis` compares against that sentinel shape, so the fixture
 *    analysis is NOT a fallback — `symbol-analysis.spec.ts` already proves this
 *    same fixture renders the real `AnalysisPanel` branch (not
 *    `TechnicalFactsSummary`) once the client-side `submitAnalysisAction`
 *    auto-run resolves.
 *
 * So both gate conditions ARE independently reachable in this harness, and the
 * POSITIVE badge-visible path is exercised directly below (not just the
 * absence/gating-only fallback the task allows for when infeasible).
 *
 * Render path / timing: the SSR page always seeds `initialAnalysis =
 * FALLBACK_ANALYSIS` (E2E has no `peekAnalysisCache` hit), so on client mount
 * `useAnalysis` auto-runs `submitAnalysisAction`, which resolves to the fixture
 * — the ~9s progress-finishing animation still runs first
 * (`AnalysisPanel`'s `showProgress`/`displayAnalyzing`), so the badge only
 * appears once that settles. We wait on the fixture summary text appearing
 * (mirrors `symbol-analysis.spec.ts`) as proof the real (non-fallback)
 * analysis has rendered before asserting the badge.
 *
 * The badge, like the fixture summary, renders inside the desktop `<aside>`
 * (implicit `role="complementary"`, `md:flex` — visible at Desktop Chrome's
 * default 1280px viewport). The same `AnalysisPanel` tree is also queued for
 * the (off-screen at this viewport, but still present in the DOM) mobile
 * bottom-sheet copy, so locators are scoped to `role=complementary` throughout
 * to avoid a strict-mode violation, exactly as `symbol-analysis.spec.ts` does.
 *
 * Routing — `playwright.config.ts`'s `ACCOUNT_SPECS` regex was widened to also
 * match this filename so it runs in the `authed` project (seeded
 * storageState, no UI login round-trip), mirroring
 * `portfolio-position.spec.ts` / `portfolio-holdings.spec.ts`.
 *
 * Isolation — like the sibling portfolio specs, this spec also owns this
 * user's AAPL holding row (the only DB-seeded ticker, so all three specs must
 * share it). `yarn e2e`'s `CI=1` → `workers: 1` serializes the `authed`
 * project against the persisted e2e Postgres, so the add/delete races never
 * collide. `beforeEach` normalizes the row away first, exactly like the
 * sibling specs.
 *
 * The complementary "member without a holding → no badge" leg (delete the
 * holding, reload, assert absence) is the core of the gating contract and is
 * asserted here directly; a guest/anonymous "no badge" leg is intentionally
 * NOT added — the `authed` project's storageState always carries a logged-in
 * member session, so there is no anonymous variant of this project to route a
 * guest test into, and the free-vs-member / holding-vs-no-holding contrast
 * already covers the full gate (the guest/free-tier and no-tier-prop cases are
 * covered by `AnalysisPanel.test.tsx`'s component-level gating tests).
 */

const PORTFOLIO_REGION_NAME = '보유종목';
const TICKER_COMBOBOX_NAME = '종목 티커 검색';
const SKELETON_TEXT = '보유종목을 불러오는 중이에요';
const SETTLE_TIMEOUT_MS = 15_000;
const BADGE_TESTID = 'personalized-analysis-badge';
const BADGE_TEXT = '내 평단 기준으로 분석했어요';

function portfolioRegion(page: Page): Locator {
    return page.getByRole('region', { name: PORTFOLIO_REGION_NAME });
}

function aaplRow(page: Page): Locator {
    return portfolioRegion(page)
        .getByRole('listitem')
        .filter({ hasText: 'AAPL' });
}

/** Scopes to the desktop analysis `<aside>` — see the file-level comment on why. */
function analysisAside(page: Page): Locator {
    return page.getByRole('complementary');
}

/**
 * Drives the (add-mode) ticker field via Enter-select — identical idiom to
 * `portfolio-holdings.spec.ts`'s `typeSymbolAndConfirm`.
 */
async function typeSymbolAndConfirm(page: Page, raw: string): Promise<void> {
    const combobox = portfolioRegion(page).getByRole('combobox', {
        name: TICKER_COMBOBOX_NAME,
    });
    await combobox.fill(raw);
    await combobox.press('Enter');
}

/** Deletes the AAPL row via the UI if present, so every run starts clean regardless of leftovers from this or the sibling portfolio specs' run against the persisted e2e Postgres. */
async function resetAaplHolding(page: Page): Promise<void> {
    await page.goto('/account');
    await expect(
        page.getByRole('heading', { level: 1, name: '계정 설정' })
    ).toBeVisible({ timeout: SETTLE_TIMEOUT_MS });

    // Wait out the client-only holdings skeleton (usePortfolioHoldings fetches
    // post-hydration) before checking for a leftover row — a check made while
    // the skeleton is still up would false-negative "no row".
    await expect(portfolioRegion(page).getByText(SKELETON_TEXT)).toHaveCount(
        0,
        { timeout: SETTLE_TIMEOUT_MS }
    );

    const row = aaplRow(page);
    if (!(await row.isVisible())) return;

    await row.getByRole('button', { name: 'AAPL 보유종목 삭제' }).click();
    await row.getByRole('button', { name: '삭제 확정' }).click();
    await expect(row).toHaveCount(0, { timeout: SETTLE_TIMEOUT_MS });
}

/** Adds an AAPL holding via /account's always-present add form. Assumes the list is empty (post-reset), so an unscoped region-level getByLabel is unambiguous — mirrors the sibling portfolio specs' step 1. */
async function addAaplHolding(
    page: Page,
    quantity: string,
    averagePrice: string
): Promise<void> {
    const region = portfolioRegion(page);
    await typeSymbolAndConfirm(page, 'aapl');
    await expect(region.getByText('AAPL', { exact: true })).toBeVisible();
    await region.getByLabel('수량').fill(quantity);
    await region.getByLabel('평단').fill(averagePrice);
    await region.getByRole('button', { name: '추가', exact: true }).click();
    await expect(aaplRow(page)).toBeVisible({ timeout: SETTLE_TIMEOUT_MS });
}

/** Navigates to /AAPL and waits for the non-fallback fixture analysis to render — the load-bearing precondition before checking the badge either way (see file-level comment). */
async function gotoAaplAndAwaitAnalysis(page: Page): Promise<void> {
    await page.goto('/AAPL');
    await expect(
        page.getByRole('heading', { level: 1, name: /AAPL/ })
    ).toBeVisible({ timeout: SETTLE_TIMEOUT_MS });
    await expect(
        analysisAside(page).getByText(ANALYSIS_FIXTURE_SUMMARY_PREFIX, {
            exact: false,
        })
    ).toBeVisible({ timeout: ANALYSIS_RENDER_TIMEOUT_MS });
}

test.describe('personalized-analysis badge (authed storageState)', () => {
    // Two full navigations to /AAPL, each waiting out the ~9s progress-finishing
    // animation before the fixture (and badge) render, plus two /account
    // add/delete round-trips — generous headroom mirrors the sibling portfolio
    // specs' full-flow budget, extended for the analysis render wait.
    test.describe.configure({ timeout: 120_000 });

    test.beforeEach(async ({ page }) => {
        await resetAaplHolding(page);
    });

    test('member with an AAPL holding sees the personalized-analysis badge; deleting the holding hides it', async ({
        page,
    }) => {
        await addAaplHolding(page, '10', '192');

        // ---- 1. member + holding + non-fallback analysis → badge renders ----
        await gotoAaplAndAwaitAnalysis(page);

        const badge = analysisAside(page).getByTestId(BADGE_TESTID);
        await expect(badge).toBeVisible({ timeout: SETTLE_TIMEOUT_MS });
        await expect(badge).toHaveText(BADGE_TEXT);

        // ---- 2. Delete the holding; member without a holding → base analysis,
        // no badge. Re-await the (still non-fallback) fixture analysis first so
        // the badge's absence is a real "no holding" gate result, not just
        // "hasn't rendered yet". ----
        await resetAaplHolding(page);
        await gotoAaplAndAwaitAnalysis(page);
        await expect(analysisAside(page).getByTestId(BADGE_TESTID)).toHaveCount(
            0
        );
    });
});
