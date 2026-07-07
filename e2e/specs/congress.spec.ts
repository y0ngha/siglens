import { test, expect } from '../support/fixtures';
import { E2E_FORCE_CONGRESS_ERROR_COOKIE } from '@/shared/api/e2eAnalysisStub';

/**
 * Congress (의회 거래) tab E2E spec — Phase B12 of the symbol-congress feature.
 *
 * Architecture notes (verified against the real DOM, not unit-test mocks):
 *
 *   - `/AAPL/congress` is an ISR RSC page. The trades table is synchronous SSR
 *     (no client fetch required): it renders from `FakeCongressTradesProvider`
 *     under E2E_TEST=1. The Fake returns RAW fixtures (`Purchase` for senate,
 *     `Sale (Partial)` for house); core's `normalizeCongressTrades` maps these
 *     to `side='buy'` / `side='sell'`. No FMP/LLM network I/O reaches the
 *     browser (enforced by the network guard in `support/fixtures`).
 *
 *   - `CongressTrendSummary` is a client component. It calls
 *     `submitCongressTrendAction` on mount, which under E2E_TEST=1 returns
 *     `e2eCachedCongressTrend()` (a deterministic fixture) synchronously — no
 *     polling. Mirrors `FinancialsAiSummary` from the financials spec.
 *
 *   - `EMPTYX` symbol: `FakeCongressTradesProvider` returns [] for both
 *     chambers, so the page renders the `CongressTradesEmpty` widget
 *     ("거래 내역 없음"). The AI summary action returns the same cached
 *     fixture (the Fake-empty path is only on the trades provider, not on the
 *     analysis stub) — but since the table is the focus of the 0건 case we
 *     only assert the empty-table copy and the indexable surface here.
 *
 *   - Resilience: `E2E_FORCE_CONGRESS_ERROR_COOKIE` instructs
 *     `submitCongressTrendAction` to return `e2eForcedCongressError()` instead
 *     of the cached fixture — the `useCongressTrend` hook throws and
 *     `CongressTrendSummaryError` renders. The trades table is SSR-independent
 *     and always renders (`Fake` ignores the cookie; only the action reads it).
 *
 *   - Bot UA: `submitCongressTrendAction` under E2E currently returns the
 *     cached fixture regardless of bot UA (the bot gate only applies to the
 *     real `submitCongressTrend` core call). We assert the minimal contract:
 *     trades table SSR is always present, and EITHER the bot notice OR the
 *     AI summary renders. This mirrors how `financials.spec.ts` handles the
 *     same gap.
 *
 * Fixture anchors:
 *   - h1 token: `${displayName} 의회 거래` (displayName for AAPL contains "AAPL")
 *   - AI summary heading: "AI 동향 해석" (from CongressTrendSummaryView/Error/Skeleton/Empty)
 *   - Cached fixture summaryKo: "최근 의회 거래는 매수 우세예요."
 *   - Empty-table copy: "거래 내역 없음" (CongressTradesEmpty)
 *   - Forced error text (from e2eForcedCongressError):
 *       "E2E 강제 congress 동향 분석 실패 (resilience 테스트용)"
 *   - Senate fixture amount: "$1,001 - $15,000"  (Purchase → side=buy)
 *   - House fixture amount: "$15,001 - $50,000"  (Sale (Partial) → side=sell)
 *   - Bot notice: "봇 트래픽으로 보여 분석 결과를 표시하지 않았어요."
 */

// Cached AI summary text (overallSentiment="bullish" → label "매수 우위")
const CONGRESS_AI_SUMMARY_KO = '최근 의회 거래는 매수 우세예요.';

// Empty-state copy from CongressTradesEmpty
const CONGRESS_EMPTY_TABLE_COPY = '거래 내역 없음';

// Forced error text rendered by CongressTrendSummaryError.
// getFmpUserFacingMessage returns null for this generic message, so the
// component falls back to error.message.
const CONGRESS_FORCED_ERROR_TEXT =
    'E2E 강제 congress 동향 분석 실패 (resilience 테스트용)';

// FakeCongressTradesProvider senate/house fixture amount strings — present in
// the SSR table when trades render.
const SENATE_FIXTURE_AMOUNT = '$1,001 - $15,000';
const HOUSE_FIXTURE_AMOUNT = '$15,001 - $50,000';

test.describe('congress: happy path', () => {
    test('page renders h1, active tab, SSR table rows, side badges and AI summary', async ({
        page,
    }) => {
        await page.goto('/AAPL/congress');

        // h1 is SSR-emitted by SymbolPageHeading. The page renders
        // `${displayName} 의회 거래`. The E2E AAPL fixture's displayName contains
        // "AAPL" so require both tokens — `/의회 거래/` alone would match any
        // symbol's congress page. Robust to displayName formatting ("AAPL",
        // "Apple Inc. (AAPL)", …).
        await expect(
            page.getByRole('heading', { level: 1, name: /AAPL.*의회 거래/ })
        ).toBeVisible();

        // Active tab has aria-current="page" on the "의회 거래" link.
        const tabNav = page.getByRole('navigation', { name: '분석 종류' });
        await expect(
            tabNav.getByRole('link', { name: '의회 거래', exact: true })
        ).toHaveAttribute('aria-current', 'page');

        // SSR table: senate fixture (Purchase, $1,001 - $15,000) and house
        // fixture (Sale (Partial), $15,001 - $50,000) both render. Both
        // amounts present implies the senate+house Fake fixtures merged
        // through normalizeCongressTrades correctly.
        await expect(
            page.getByText(SENATE_FIXTURE_AMOUNT, { exact: false }).first()
        ).toBeVisible();
        await expect(
            page.getByText(HOUSE_FIXTURE_AMOUNT, { exact: false }).first()
        ).toBeVisible();

        // Side badges: Purchase → "매수" buy badge, Sale (Partial) → "매도"
        // sell badge. Both must be present when the senate+house fixtures
        // render.
        await expect(
            page.getByText('매수', { exact: true }).first()
        ).toBeVisible();
        await expect(
            page.getByText('매도', { exact: true }).first()
        ).toBeVisible();

        // AI summary section renders the cached fixture text. Under E2E the
        // stub returns synchronously — short timeout is sufficient.
        await expect(
            page.getByRole('heading', { level: 2, name: 'AI 동향 해석' })
        ).toBeVisible({ timeout: 10_000 });
        await expect(
            page.getByText(CONGRESS_AI_SUMMARY_KO, { exact: false })
        ).toBeVisible({ timeout: 10_000 });
    });
});

test.describe('congress: sparse (0 trades)', () => {
    test('EMPTYX renders h1, empty-table copy and 200 (noindex via longtail gate, not degrade)', async ({
        page,
    }) => {
        // EMPTYX is the e2e sentinel symbol: FakeCongressTradesProvider returns
        // [] for both chambers. The page must still render successfully
        // (200) with the normal empty-state UI because 0 trades is a sparse-
        // ticker state — not a degrade. This is the documented difference
        // from financials, where 0 rows is treated as degrade.
        const response = await page.goto('/EMPTYX/congress');

        // 200 OK — not 404, not 500.
        expect(response?.status()).toBe(200);

        // h1 is SSR — present regardless of trades. EMPTYX's displayName is
        // "EMPTYX" (the AAPL koreanName mapping does not apply), so the h1
        // is `EMPTYX 의회 거래`.
        await expect(
            page.getByRole('heading', { level: 1, name: /EMPTYX.*의회 거래/ })
        ).toBeVisible();

        // noindex — but for a different reason than sparse trades. Since the
        // longtail index-quality gate (evaluateSymbolIndexability, PR #678)
        // landed, any symbol outside POPULAR_TICKERS/APPROVED_LONGTAIL_TICKERS
        // is 'longtail-default-blocked' regardless of degrade/trade state.
        // EMPTYX is a fake e2e sentinel, never in either allowlist, so this
        // page is always noindex now. This assertion is NOT proof of degrade —
        // the body below still renders the normal empty-state UI (not
        // CongressDegraded), proving sparse ≠ degrade at the content level.
        await expect(
            page.locator('meta[name="robots"][content*="noindex"]')
        ).toHaveCount(1);

        // Empty-state card rendered by CongressTradesEmpty.
        await expect(
            page.getByText(CONGRESS_EMPTY_TABLE_COPY, { exact: true })
        ).toBeVisible();
    });
});

test.describe('congress: resilience', () => {
    test('AI error cookie → error UI shown; trades table still renders', async ({
        page,
        context,
    }) => {
        // Inject the force-error cookie before navigation so the server action
        // returns e2eForcedCongressError() on mount.
        await context.addCookies([
            {
                name: E2E_FORCE_CONGRESS_ERROR_COOKIE,
                value: '1',
                url: 'http://localhost:4300',
            },
        ]);

        await page.goto('/AAPL/congress');

        // The AI error section renders with the forced error message.
        // CongressTrendSummaryError renders `error.message` via role="alert".
        await expect(
            page.getByRole('alert').filter({
                hasText: CONGRESS_FORCED_ERROR_TEXT,
            })
        ).toBeVisible({ timeout: 10_000 });

        // The AI section heading is still "AI 동향 해석" in the error view.
        await expect(
            page.getByRole('heading', { level: 2, name: 'AI 동향 해석' })
        ).toBeVisible();

        // The trades table (SSR) is independent of the AI action — it must
        // still render the Fake fixtures. (Fake provider does not honor the
        // error cookie; only the analysis action reads it.)
        await expect(
            page.getByText(SENATE_FIXTURE_AMOUNT, { exact: false }).first()
        ).toBeVisible();
        await expect(
            page.getByText(HOUSE_FIXTURE_AMOUNT, { exact: false }).first()
        ).toBeVisible();

        // Tab navigation is alive (error is isolated to the AI section).
        await expect(
            page.getByRole('navigation', { name: '분석 종류' })
        ).toBeVisible();

        // 다시 시도 button is present in the error section.
        await expect(
            page.getByRole('button', { name: '다시 시도' })
        ).toBeVisible();

        // Clear the error cookie and retry — the action now returns the cached
        // fixture, the hook's error boundary resets, and the real AI summary
        // renders.
        await context.clearCookies({ name: E2E_FORCE_CONGRESS_ERROR_COOKIE });
        await page.getByRole('button', { name: '다시 시도' }).click();

        // Error message disappears and the cached AI summary renders.
        await expect(
            page.getByText(CONGRESS_FORCED_ERROR_TEXT, { exact: false })
        ).toHaveCount(0, { timeout: 10_000 });
        await expect(
            page.getByText(CONGRESS_AI_SUMMARY_KO, { exact: false })
        ).toBeVisible({ timeout: 10_000 });
    });

    test('bot UA → AI section bot notice OR cached fixture; trades table still renders', async ({
        page,
    }) => {
        // Set an AI-bot UA (matches AI_BOT_RE — ClaudeBot).
        // The congress analysis action under E2E currently returns the cached
        // fixture regardless of UA (the bot gate only applies to the real
        // `submitCongressTrend` core call). We assert the minimal contract:
        // trades table SSR is always present, and either the bot notice or
        // the AI summary renders. This mirrors financials.spec.ts.
        await page.setExtraHTTPHeaders({
            'User-Agent':
                'Mozilla/5.0 (compatible; ClaudeBot/1.0; +https://claude.ai/bot)',
        });

        await page.goto('/AAPL/congress');

        // Trades table is SSR — present regardless of bot status.
        await expect(
            page.getByText(SENATE_FIXTURE_AMOUNT, { exact: false }).first()
        ).toBeVisible();

        // Either the BotBlockedNotice OR the cached AI summary renders.
        const botNotice = page.getByText(
            '봇 트래픽으로 보여 분석 결과를 표시하지 않았어요.',
            { exact: false }
        );
        const aiSummaryText = page.getByText(CONGRESS_AI_SUMMARY_KO, {
            exact: false,
        });
        await expect(botNotice.or(aiSummaryText).first()).toBeVisible({
            timeout: 10_000,
        });
    });
});

// Invalid ticker / 404 is intentionally omitted here — it is already covered
// by the shared `not-found.spec.ts` suite and the page's notFound() branch is
// identical to financials/fundamental (gated by VALID_TICKER_RE + profile===null).
