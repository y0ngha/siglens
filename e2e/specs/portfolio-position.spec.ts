import { test, expect } from '../support/fixtures';
import type { Locator, Page } from '@playwright/test';

/**
 * Authed spec — exercises the CURRENT placement of the "내 위치" position
 * widget after the position-building redesign moved it OFF the analysis page
 * entirely and into two dedicated surfaces:
 *   - `[symbol]/position` — a symbol tab (`src/app/[symbol]/position/page.tsx`
 *     → `PositionTabContent` → member-gated `PositionTabMemberContent` →
 *     `PositionBuilding` (SVG, `role="img"`, `data-testid="position-building"`)
 *     + `PositionCard` (readouts, an implicit `role="region"` section via
 *     `aria-labelledby` on its "내 위치" `<h2>`)).
 *   - `/portfolio` — a member page (`src/app/portfolio/page.tsx` →
 *     `PortfolioGuard` → one `PositionHoldingCard` per holding, each embedding
 *     the same `PositionBuilding`).
 *
 * This spec previously asserted the widget rendered directly ON `/AAPL`
 * (removed in `f1d41322`, "remove vertical gauge from analysis page") — it is
 * rewritten below to (1) prove the analysis page no longer carries it at all,
 * even for a member who DOES hold the symbol, and (2) exercise both new
 * surfaces' member/holding-gated rendering.
 *
 * BARS AVAILABILITY: `FakeMarketProvider.getBars` (`src/shared/api/market/
 * FakeMarketProvider.ts`) always returns the fixed 3-bar fixture
 * `e2e/fixtures/bars.json` under `E2E_TEST=1`, regardless of symbol, so the
 * range for AAPL (the only DB-seeded ticker — `e2e/setup/seed.ts`) is real
 * and non-empty — the positive "member + holding + valid range → building
 * renders" path is reachable in this harness.
 *
 * NOT pinning exact high/low/current literals (unlike the deleted spec):
 * `[symbol]/position`'s SSR range comes from `resolvePriceRange` →
 * `getBarsStatic` → `quantizeBarsDataToLastClosed(bars, new Date(), ...)`
 * (`src/app/[symbol]/position/page.tsx`), which — UNLIKE the deleted
 * analysis-page gauge's client-only `getBarsAction` path — drops the last
 * (still-forming) bar whenever the real wall-clock `now` falls inside a live
 * US equity regular session (`src/entities/bars/lib/quantizeBars.ts`). That
 * makes high52w/low52w/lastClose depend on the real time this suite happens
 * to run, so pinning their literal values (as the deleted spec safely did for
 * the client-only path) would be flaky here. `avg` is NOT bars-derived (it is
 * the value this spec itself enters via the holding form), so it alone is
 * pinned; everything bars-derived is asserted with shape-only patterns.
 *
 * Routing — `playwright.config.ts`'s `ACCOUNT_SPECS` regex already matches
 * this filename (`portfolio-(holdings|position)`), so it keeps running in the
 * `authed` project (seeded storageState, no UI login round-trip).
 *
 * Isolation — like the sibling portfolio specs, this spec owns this user's
 * AAPL holding row (the only DB-seeded ticker). `yarn e2e`'s `CI=1` →
 * `workers: 1` serializes the `authed` project against the persisted e2e
 * Postgres, so the add/delete round-trips across specs never race.
 * `beforeEach` normalizes the row away first, exactly like the sibling specs.
 */

const PORTFOLIO_REGION_NAME = '보유종목';
const TICKER_COMBOBOX_NAME = '종목 티커 검색';
const POSITION_REGION_NAME = '내 위치';
const SKELETON_TEXT = '보유종목을 불러오는 중이에요';
const SETTLE_TIMEOUT_MS = 15_000;

function portfolioRegion(page: Page): Locator {
    return page.getByRole('region', { name: PORTFOLIO_REGION_NAME });
}

function aaplRow(page: Page): Locator {
    return portfolioRegion(page)
        .getByRole('listitem')
        .filter({ hasText: 'AAPL' });
}

function positionRegion(page: Page): Locator {
    return page.getByRole('region', { name: POSITION_REGION_NAME });
}

/**
 * Scopes to the single readout row (`PositionCard.tsx`'s `ReadoutRow`, a
 * `<dt>`+`<dd>` pair inside one flex `<div>`) whose concatenated text starts
 * with `startPattern`. Anchoring at the start (not a bare substring) matters
 * because several labels prefix others verbatim — `최근 고점`/`최근 저점` are
 * prefixes of `최근 고점 대비`/`최근 저점 대비` — so an unanchored substring
 * filter would strict-mode-violate on two rows.
 */
function readoutRow(page: Page, startPattern: RegExp): Locator {
    return positionRegion(page)
        .locator('dl > div')
        .filter({ hasText: startPattern });
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

/**
 * Adds an AAPL holding via /account's always-present add form. Self-contained:
 * navigates to /account first (the add form lives there, NOT on /AAPL/position
 * or /portfolio — a test that just visited one of those must land back on
 * /account before the combobox exists), then waits out the client-only
 * holdings skeleton exactly like resetAaplHolding. Assumes the list is empty
 * (post-reset), so an unscoped region-level getByLabel is unambiguous —
 * mirrors the sibling portfolio specs' step 1.
 */
async function addAaplHolding(
    page: Page,
    quantity: string,
    averagePrice: string
): Promise<void> {
    await page.goto('/account');
    await expect(
        page.getByRole('heading', { level: 1, name: '계정 설정' })
    ).toBeVisible({ timeout: SETTLE_TIMEOUT_MS });
    await expect(portfolioRegion(page).getByText(SKELETON_TEXT)).toHaveCount(
        0,
        { timeout: SETTLE_TIMEOUT_MS }
    );

    const region = portfolioRegion(page);
    await typeSymbolAndConfirm(page, 'aapl');
    await expect(region.getByText('AAPL', { exact: true })).toBeVisible();
    await region.getByLabel('수량').fill(quantity);
    await region.getByLabel('평단').fill(averagePrice);
    await region.getByRole('button', { name: '추가', exact: true }).click();
    await expect(aaplRow(page)).toBeVisible({ timeout: SETTLE_TIMEOUT_MS });
}

test.describe('position widget placement (authed storageState)', () => {
    // Multiple full navigations (analysis page, position tab ×2, /account
    // add round-trip) — mirrors the sibling portfolio specs' full-flow budget.
    test.describe.configure({ timeout: 90_000 });

    test.beforeEach(async ({ page }) => {
        await resetAaplHolding(page);
    });

    test('the analysis page (/AAPL) no longer contains the position widget, even for a member who holds the symbol', async ({
        page,
    }) => {
        // Worst case: member DOES hold AAPL — if the widget were still wired
        // up anywhere on the analysis page, this is the state that would
        // reveal it. Its absence here proves a real removal, not just an
        // unmet holding gate.
        await addAaplHolding(page, '10', '192');

        await page.goto('/AAPL');
        await expect(
            page.getByRole('heading', { level: 1, name: /AAPL/ })
        ).toBeVisible({ timeout: SETTLE_TIMEOUT_MS });

        await expect(page.getByTestId('position-building')).toHaveCount(0);
        await expect(
            page.getByRole('region', { name: POSITION_REGION_NAME })
        ).toHaveCount(0);
    });

    test('[symbol]/position tab: a member without a holding sees the CTA; adding one renders the building', async ({
        page,
    }) => {
        // ---- 1. No holding (post-reset) → CTA to /onboarding, no building ----
        await page.goto('/AAPL/position');
        await expect(
            page.getByRole('heading', { level: 1, name: /AAPL/ })
        ).toBeVisible({ timeout: SETTLE_TIMEOUT_MS });

        const cta = page.getByTestId('position-cta');
        await expect(cta).toBeVisible({ timeout: SETTLE_TIMEOUT_MS });
        await expect(
            cta.getByRole('link', { name: '보유종목 등록하기' })
        ).toHaveAttribute('href', '/onboarding');
        await expect(page.getByTestId('position-building')).toHaveCount(0);

        // ---- 2. Add an AAPL holding, revisit → the building + readout card render ----
        await addAaplHolding(page, '10', '192');
        await page.goto('/AAPL/position');
        await expect(
            page.getByRole('heading', { level: 1, name: /AAPL/ })
        ).toBeVisible({ timeout: SETTLE_TIMEOUT_MS });

        const building = page.getByTestId('position-building');
        await expect(building).toBeVisible({ timeout: SETTLE_TIMEOUT_MS });

        // aria-label's avg segment is pinned ($192, this spec's own input);
        // the bars-derived segments (현재가/수익률/범위 위치) are asserted by
        // shape only — see file-level comment on why they can't be pinned.
        const img = building.getByRole('img', { name: /^AAPL 내 위치:/ });
        await expect(img).toHaveAccessibleName(
            /^AAPL 내 위치: 평단 \$192, 현재가 \$[\d,.]+, 수익률 [+-][\d.]+%, 최근 범위의 \d+% 지점$/
        );

        const region = positionRegion(page);
        await expect(region).toBeVisible({ timeout: SETTLE_TIMEOUT_MS });
        await expect(readoutRow(page, /^내 평단\$/)).toContainText('$192');
        await expect(page.getByTestId('position-cta')).toHaveCount(0);
    });
});

test.describe('/portfolio page (authed storageState)', () => {
    // One /account add round-trip + one /portfolio navigation, plus the
    // in-view bars fetch each PositionHoldingCard fires once visible.
    test.describe.configure({ timeout: 90_000 });

    test.beforeEach(async ({ page }) => {
        await resetAaplHolding(page);
    });

    test('a member with a holding sees the /portfolio heading and a holding card with a building', async ({
        page,
    }) => {
        await addAaplHolding(page, '10', '192');

        await page.goto('/portfolio');
        await expect(
            page.getByRole('heading', { level: 1, name: '내 포트폴리오 위치' })
        ).toBeVisible({ timeout: SETTLE_TIMEOUT_MS });

        const grid = page.getByTestId('portfolio-holding-grid');
        await expect(grid).toBeVisible({ timeout: SETTLE_TIMEOUT_MS });

        const card = grid
            .getByTestId('portfolio-holding-card')
            .filter({ hasText: 'AAPL' });
        await expect(card).toBeVisible({ timeout: SETTLE_TIMEOUT_MS });
        await expect(card.getByTestId('position-building')).toBeVisible({
            timeout: SETTLE_TIMEOUT_MS,
        });
    });
});
