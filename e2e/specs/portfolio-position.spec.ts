import { test, expect } from '../support/fixtures';
import type { Locator, Page } from '@playwright/test';

/**
 * Authed spec — exercises the member-only "내 위치" position gauge
 * (`src/widgets/portfolio-position/`: `PositionSectionMounted` → lazy
 * `PositionSection` → `PositionCard` → `PositionGauge`) rendered on the
 * symbol chart tab. It shows ONLY when: hydrated + a member is present + the
 * member holds this symbol + a valid recent high/low range exists (from
 * `buildTechnicalFacts(bars, indicators)`, `src/views/symbol/utils/
 * technicalFacts.ts` — this needs BARS).
 *
 * BARS AVAILABILITY (the load-bearing feasibility question for this spec):
 * `FakeMarketProvider.getBars` (`src/shared/api/market/FakeMarketProvider.ts`)
 * always returns the fixed 3-bar fixture `e2e/fixtures/bars.json` under
 * `E2E_TEST=1`, regardless of symbol. `bars.length === 3` clears
 * `buildTechnicalFacts`'s `MIN_BARS_FOR_FACTS = 2` gate, so for AAPL (the
 * only DB-seeded ticker — `e2e/setup/seed.ts`) the range IS real and
 * non-empty: `high52w = $196` (max high across the fixture), `low52w =
 * $189.2` (min low), `lastClose = $195.7` (last bar's close). So the
 * positive "member + holding + valid range → gauge renders" path IS
 * reachable in this harness; this spec asserts it directly (pinned literal
 * numbers, verified against the fixture below) rather than falling back to
 * a gating-only check.
 *
 * Routing — `playwright.config.ts`'s `ACCOUNT_SPECS` regex was widened to
 * also match this filename so it runs in the `authed` project (seeded
 * storageState, no UI login round-trip), mirroring
 * `portfolio-holdings.spec.ts`.
 *
 * Symbol/avg choice — AAPL (the only seeded ticker) with avg=$192, chosen
 * INSIDE the fixture's [$189.2, $196] range so the gauge renders its
 * "in-range" state with no `outOfRangeNote` caveat text (`PositionGauge.tsx`)
 * — the cleanest full-signal render to assert against. Every readout below
 * (aria-label, `최근 고점`/`최근 저점`/`현재가`/`내 평단`/`수익률`) was
 * computed once against the fixture + this avg and pinned as literals, so a
 * regression in `computePosition`/`buildTechnicalFacts`'s math fails loudly
 * — not just "gauge missing".
 *
 * Isolation — like `portfolio-holdings.spec.ts`, this spec also owns this
 * user's AAPL holding row (it is the only DB-seeded ticker, so both specs
 * must use it). `yarn e2e`'s `CI=1` → `workers: 1` serializes the `authed`
 * project against the persisted e2e Postgres, so the two specs' add/delete
 * of the same row never race each other. `beforeEach` normalizes the row
 * away first, exactly like `portfolio-holdings.spec.ts`.
 */

const PORTFOLIO_REGION_NAME = '보유종목';
const TICKER_COMBOBOX_NAME = '종목 티커 검색';
const POSITION_REGION_NAME = '내 위치';
const SKELETON_TEXT = '보유종목을 불러오는 중이에요';
const CHIP_UNSET_TEXT = '평단 설정';
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

/** Deletes the AAPL row via the UI if present, so every run starts clean regardless of leftovers from this or the sibling portfolio-holdings.spec.ts run against the persisted e2e Postgres. */
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

/** Adds an AAPL holding via /account's always-present add form. Assumes the list is empty (post-reset), so an unscoped region-level getByLabel is unambiguous — mirrors portfolio-holdings.spec.ts's step 1. */
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

test.describe('portfolio position gauge (authed storageState)', () => {
    // Two full navigations to /AAPL (each waits on a client-side holdings
    // fetch + lazy chunk) plus the /account add/delete round-trips; mirrors
    // portfolio-holdings.spec.ts's full-flow budget.
    test.describe.configure({ timeout: 90_000 });

    test.beforeEach(async ({ page }) => {
        await resetAaplHolding(page);
    });

    test('member with an AAPL holding sees the position gauge with a bars-derived range; deleting the holding hides it', async ({
        page,
    }) => {
        await addAaplHolding(page, '10', '192');

        // ---- 1. The gauge renders on /AAPL from the FakeMarketProvider fixture-derived range ----
        await page.goto('/AAPL');
        await expect(
            page.getByRole('heading', { level: 1, name: /AAPL/ })
        ).toBeVisible({ timeout: SETTLE_TIMEOUT_MS });

        const region = positionRegion(page);
        await expect(region).toBeVisible({ timeout: SETTLE_TIMEOUT_MS });
        await expect(
            page.getByRole('heading', { level: 2, name: POSITION_REGION_NAME })
        ).toBeVisible();

        // The gauge's aria-label is fully deterministic from the fixture
        // (high=$196 / low=$189.2 / lastClose=$195.7) and our avg=$192 —
        // pinned verbatim so a regression in computePosition/
        // buildTechnicalFacts's math fails loudly, not just "gauge missing".
        const gauge = region.getByRole('img', { name: /^AAPL 내 위치:/ });
        await expect(gauge).toHaveAccessibleName(
            'AAPL 내 위치: 평단 $192, 현재가 $195.7, 수익률 +1.9%, 최근 범위의 41% 지점'
        );

        await expect(readoutRow(page, /^최근 고점\$/)).toContainText('$196');
        await expect(readoutRow(page, /^최근 저점\$/)).toContainText('$189.2');
        await expect(readoutRow(page, /^현재가\$/)).toContainText('$195.7');
        await expect(readoutRow(page, /^내 평단\$/)).toContainText('$192');
        await expect(readoutRow(page, /^수익률[+-]/)).toContainText('+1.9%');

        // ---- 2. Delete the holding; the header chip (PortfolioChip) reads
        // the exact same holdings-query cache (usePortfolioHoldings) as the
        // gauge (useSymbolHolding), so waiting for the chip's "unset" copy
        // proves the query has resolved with no AAPL holding — the gauge's
        // absence at that point is a real "member without a holding renders
        // nothing", not just "hasn't fetched yet". ----
        await resetAaplHolding(page);
        await page.goto('/AAPL');
        await expect(
            page.getByRole('heading', { level: 1, name: /AAPL/ })
        ).toBeVisible({ timeout: SETTLE_TIMEOUT_MS });
        await expect(
            page.getByRole('button', { name: CHIP_UNSET_TEXT })
        ).toBeVisible({ timeout: SETTLE_TIMEOUT_MS });
        await expect(positionRegion(page)).toHaveCount(0);
    });
});
