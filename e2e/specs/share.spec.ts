import { test, expect } from '../support/fixtures';
import { E2E_FORCE_ANALYSIS_ERROR_COOKIE } from '@/shared/api/e2eAnalysisStub';

/**
 * Share flow E2E — Task 13.1 + Addendum D-4.
 *
 * Infra notes:
 *   - HYBRID backend (E2E_TEST=1): analysis submit short-circuits to cached
 *     fixtures; DB reads/writes (shared_analyses) are live Neon.
 *   - workers: 1 (serialised in CI), baseURL: http://localhost:4300.
 *   - Network guard in fixtures.ts: all browser requests must stay on localhost:4300.
 *
 * Scenario feasibility decisions:
 *
 *   1. ShareButton visible on multiple tabs — REAL TEST.
 *      The button is mounted in SymbolLayoutHeader which renders on every
 *      /[symbol]/* route. Asserting via aria-label "분석 결과 공유".
 *
 *   2. /share/<nonexistent-id> → empty-state — REAL TEST.
 *      The route returns HTTP 404 and the 404 page renders the expired-link copy.
 *      Copy: "이 공유 링크는 만료됐어요" (page.tsx renders the same UI for
 *      both expired and not_found per the current implementation).
 *
 *   3. /share/<expired-id> → expired copy on the 404 page — SKIPPED.
 *      Reason: no DB seeding helper exists for the shared_analyses table in
 *      this E2E suite (seed.ts only seeds asset rows). Seeding an expired row
 *      directly would require DB access inside setup/seed.ts, which is out of
 *      scope for this task. The not-found test (scenario 2) covers the same
 *      empty-state UI path that expired rows also render.
 *
 *   4. /share/[id] happy path — REAL TEST (scenario 4 below).
 *      seed.ts inserts a chart-kind snapshot row (E2E_SHARE_ID, expiresAt=2099).
 *      The panel + disclaimer + CTA render path is asserted against the seeded row.
 *
 *   5. confirm → loading → share interactive flow — REAL TEST (deterministic
 *      only). A plain-navigation variant of this test ("clicking ShareButton
 *      with no ready analysis shows dialog or unavailable notice") was
 *      removed (mutation-coverage audit, 2026-08-18): its premise was false
 *      on both asserted branches. 'pending' status routes to
 *      SharePreparingModal (role="dialog", name "분석 준비 중"), not
 *      ShareTriggerDialog — so that branch could never match. 'idle' is
 *      unreachable because `[symbol]/page.tsx` hardcodes
 *      `initialAnalysisFailed={true}`, and `useShareFlow` destroys the only
 *      window where `reg === null` (the "unavailable notice" branch) in the
 *      same commit as registration. The only test that can pass
 *      deterministically is the one below, which forces status 'error' via
 *      `E2E_FORCE_ANALYSIS_ERROR_COOKIE` — that is the sole real coverage for
 *      this scenario now.
 */

const SHARE_BUTTON_LABEL = '분석 결과 공유';
const TRIGGER_DIALOG_TITLE = '공유하기 전에 분석을 준비할게요';

/**
 * Known share id seeded in e2e/setup/seed.ts for the golden-path test.
 * The row contains a chart-kind AnalysisResponse snapshot for AAPL with
 * expires_at = 2099, so it is always found by getCachedSharedAnalysis.
 */
const E2E_SHARE_ID = 'e2e-share-chart-aapl-fixture01';

test.describe('share button: visible on symbol tabs', () => {
    /**
     * The ShareButton is mounted in SymbolLayoutHeader, which is the
     * layout-level header shared by ALL /[symbol]/* routes. Spot-check two
     * distinct tabs: the chart root and the news sub-route.
     *
     * We assert by aria-label (the button has aria-label="분석 결과 공유")
     * which is viewport-independent (the header is always visible on desktop,
     * our default chromium Desktop Chrome viewport).
     */
    test('share button is visible on the chart tab', async ({ page }) => {
        await page.goto('/AAPL');

        await expect(
            page.getByRole('button', { name: SHARE_BUTTON_LABEL })
        ).toBeVisible();
    });

    test('share button is visible on the news tab', async ({ page }) => {
        await page.goto('/AAPL/news');

        await expect(
            page.getByRole('button', { name: SHARE_BUTTON_LABEL })
        ).toBeVisible();
    });

    test('share button is visible on the fundamental tab', async ({ page }) => {
        await page.goto('/AAPL/fundamental');

        await expect(
            page.getByRole('button', { name: SHARE_BUTTON_LABEL })
        ).toBeVisible();
    });
});

test.describe('share: /share/[id] not-found → real 404', () => {
    /**
     * /share/<unknown-id>는 **상태 코드 404**여야 한다. 예전에는 200 + 만료 안내였고,
     * 그 조합이 GSC에서 soft-404로 분류돼 품질 신호를 깎았다(2026-09 구글 정책 감사).
     * 문구는 잃지 않는다 — `[locale]/NotFoundMessage`가 `/share/` 경로를 보고 같은
     * 만료 안내를 그린다(그래서 h1 단언이 그대로다).
     *
     * NOTE: 페이지는 'not_found'와 'expired'를 같은 분기로 처리하므로
     * (`if (lookup.status !== 'found')`) 이 테스트가 만료 경로도 함께 덮는다.
     */
    test('unknown share id returns HTTP 404', async ({ page }) => {
        const response = await page.goto(
            '/share/nonexistent-id-that-does-not-exist-xyz123'
        );

        expect(response?.status()).toBe(404);
    });

    test('renders the expired-link copy on the 404 page', async ({ page }) => {
        await page.goto('/share/nonexistent-id-that-does-not-exist-xyz123');

        await expect(
            page.getByRole('heading', {
                level: 1,
                name: '이 공유 링크는 만료됐어요',
            })
        ).toBeVisible();

        const homeLink = page.getByRole('link', {
            name: /홈으로 돌아가기/,
        });
        await expect(homeLink).toBeVisible();
        await expect(homeLink).toHaveAttribute('href', '/');
    });

    test('the not-found home link navigates back to the landing page', async ({
        page,
    }) => {
        await page.goto('/share/nonexistent-id-that-does-not-exist-xyz123');

        await page.getByRole('link', { name: /홈으로 돌아가기/ }).click();
        await page.waitForURL('**/');

        // Landing page renders the ticker search combobox
        await expect(
            page
                .getByRole('banner')
                .getByRole('combobox', { name: '종목 티커 검색' })
        ).toBeVisible();
    });
});

test.describe('share: /share/[expired-id] expired empty state', () => {
    /**
     * @skip-reason: seed.ts now seeds shared_analyses (E2E_SHARE_ID row with
     * expiresAt=2099). An expired-row seed (expiresAt in the past) is not yet
     * added because the not-found test above covers the identical empty-state UI
     * path (page.tsx renders the same branch for both expired and not_found).
     * Adding a seeded expired row would require a second insert in seed.ts with
     * a past expiresAt, which is out of scope for this task.
     *
     * When an expired-row seed is added to e2e/setup/seed.ts, implement as:
     *   1. Seed a row with expiresAt = yesterday.
     *   2. GET /share/<seeded-id> and assert the empty-state h1.
     */
    test.skip('renders expired empty state for a seeded expired share', async ({
        page,
    }) => {
        // TODO: seed a row via e2e/setup/seed.ts with expiresAt in the past,
        // then navigate and assert the h1 copy.
        void page;
        expect(true).toBe(true);
    });
});

test.describe('share: happy path /share/[id] panel', () => {
    /**
     * Golden-path test for the /share/[id] route with a seeded chart-kind snapshot.
     *
     * The row is inserted in e2e/setup/seed.ts (shared_analyses table) with:
     *   - id: E2E_SHARE_ID
     *   - kind: 'chart', symbol: 'AAPL'
     *   - snapshotJson: minimal valid AnalysisResponse
     *   - expiresAt: 2099-01-01 (always found)
     *
     * Asserts:
     *   1. The analysis panel renders — anchored on the fixture summary text
     *      "E2E 공유 스냅샷 고정 분석 요약입니다." present in the AnalysisPanel.
     *   2. The "as-of" disclaimer box is visible (contains "데이터라서 현재 시세와 다를 수 있어요").
     *   3. The investment disclaimer note (role="note") is visible.
     *   4. The viral CTA link to /AAPL is present.
     */
    test('renders read-only panel, disclaimer and viral CTA for a valid share id', async ({
        page,
    }) => {
        await page.goto(`/share/${E2E_SHARE_ID}`);

        // The as-of disclaimer banner is always rendered for found shares.
        await expect(
            page.getByText(/데이터라서 현재 시세와 다를 수 있어요/)
        ).toBeVisible({ timeout: 10_000 });

        // The investment disclaimer note is always rendered for found shares.
        // Scope to <main>: the global site footer also renders a role="note"
        // disclaimer, so an unscoped getByRole('note') is a strict-mode violation.
        await expect(page.getByRole('main').getByRole('note')).toBeVisible();

        // The viral CTA link points to the ticker's symbol page.
        const ctaLink = page.getByRole('link', {
            name: /AAPL 직접 분석하기/,
        });
        await expect(ctaLink).toBeVisible();
        await expect(ctaLink).toHaveAttribute('href', '/AAPL');

        // The kind chip in the h1 shows "차트 분석" (kindLabel for 'chart').
        await expect(page.getByRole('heading', { level: 1 })).toContainText(
            '차트 분석'
        );
    });
});

test.describe('share: confirm → loading interactive flow', () => {
    /**
     * Deterministic ShareTriggerDialog assertion via the options force-error seam.
     *
     * The chart tab's analysis auto-resolves to the E2E fixture ('success') on a
     * timing we can't control, so clicking Share there races between idle / pending /
     * success and the trigger dialog appears only intermittently. Instead we drive
     * the OPTIONS tab into a deterministic 'error' state with
     * E2E_FORCE_ANALYSIS_ERROR_COOKIE (the same seam resilience.spec uses).
     *
     * OptionsAiAnalysis calls useRegisterShareable({ status: mapAnalysisStatus(
     * state.status), ... }) unconditionally and, on error, renders an inline error
     * component (NOT a thrown React error boundary), so it stays mounted and
     * registers status 'error'. mapAnalysisStatus('error') === 'error', so the
     * ShareButton's onClick opens the ShareTriggerDialog reliably — no timing race.
     */
    test('ShareTriggerDialog appears with confirm and cancel CTAs', async ({
        page,
        context,
    }) => {
        await context.addCookies([
            {
                name: E2E_FORCE_ANALYSIS_ERROR_COOKIE,
                value: '1',
                url: 'http://localhost:4300',
            },
        ]);

        await page.goto('/AAPL/options');

        // Deterministic error state — options registration status becomes 'error'.
        await expect(
            page.getByText(
                '옵션 분석을 가져오지 못했어요. 잠시 후 다시 시도해주세요.'
            )
        ).toBeVisible();

        const shareButton = page.getByRole('button', {
            name: SHARE_BUTTON_LABEL,
        });
        await expect(shareButton).toBeVisible();
        await shareButton.click();

        // status 'error' → ShareTriggerDialog opens (deterministic, no race).
        const triggerDialog = page.getByRole('dialog', {
            name: TRIGGER_DIALOG_TITLE,
        });
        await expect(triggerDialog).toBeVisible({ timeout: 5_000 });

        // Primary + cancel CTAs prove the dialog rendered fully.
        await expect(
            page.getByRole('button', { name: '분석하고 공유하기' })
        ).toBeVisible();
        await expect(
            page.getByRole('button', { name: '다음에' })
        ).toBeVisible();

        // Escape closes the dialog (useEscapeKey wired).
        await page.keyboard.press('Escape');
        await expect(triggerDialog).not.toBeVisible({ timeout: 2_000 });
    });
});
