import { test, expect } from '../support/fixtures';
import type { Locator, Page } from '@playwright/test';

/**
 * Authed Tier 2 spec — exercises the "Portfolio Holdings Foundation" CRUD
 * (docs/superpowers/specs/2026-07-17-portfolio-holdings-foundation-design.md)
 * end to end against the real local Postgres:
 *   - the account-page section (features/portfolio-management/PortfolioSection)
 *   - the symbol-page header chip (features/portfolio-holding/PortfolioChip +
 *     PortfolioChipPopover), which reads the SAME React Query list cache
 *     (entities/portfolio usePortfolioHoldings, key ['portfolio-holdings']) —
 *     invalidated on every save/delete so both surfaces reflect one truth.
 *
 * Runs in the `authed` Playwright project (shared storageState, the seeded
 * e2e-auth-user) — playwright.config.ts's ACCOUNT_SPECS routing regex was
 * extended to also match this filename so both surfaces get a real session
 * without a UI login round-trip.
 *
 * Symbol choice — AAPL only: it is the ONE ticker seeded into
 * asset_translations (e2e/setup/seed.ts), so savePortfolioHoldingAction's
 * getAssetInfo existence check resolves it via the DB (never FMP) —
 * deterministic company-name enrichment ("Apple Inc.") with zero dependency
 * on FMP_API_KEY, which this harness intentionally never provides
 * (docs/qa/E2E.md). A never-seeded symbol would still SAVE successfully
 * (getAssetInfo throwing on a missing FMP key is the documented
 * degrade-tolerant "accept" path — design §5), so it cannot be used to prove
 * rejection; the worst-case test below instead drives a symbol that is
 * shape-invalid, which validateHoldingInput rejects before any existence
 * check or DB write.
 *
 * Ticker-field interaction: HoldingForm embeds TickerAutocomplete with
 * navigateOnSelect={false}. Per useAutocomplete.navigate(), BOTH clicking a
 * dropdown option AND pressing Enter with no option selected call
 * onSelect(symbol) synchronously (the Enter branch uses
 * `query.trim().toUpperCase()` verbatim) — Enter is used throughout below so
 * the flow needs no dependency on the E2E ticker-search fixture's exact
 * result set (searchTickerAction, hermetic under E2E_TEST — see
 * symbol-search.spec.ts), and so the worst-case test can drive a
 * shape-invalid symbol (embedded space) that the fixture would never return
 * as a selectable option.
 *
 * Isolation: this is the only spec that touches this user's AAPL holding row.
 * beforeEach normalizes it away (UI delete if present) so repeated runs
 * against the persisted e2e Postgres (docs/qa/E2E.md: `e2e:down -v` is the
 * only reset) start from a known-clean state, mirroring
 * account-api-key.spec.ts's register/delete normalization. The worst-case
 * (invalid symbol) test never reaches the DB, so it cannot race the main flow
 * even under local parallel workers.
 */

const PORTFOLIO_REGION_NAME = '보유종목';
const TICKER_COMBOBOX_NAME = '종목 티커 검색';
const EMPTY_STATE_TEXT = '아직 등록한 보유종목이 없어요';
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

/**
 * Drives the (add-mode) ticker field via Enter-select, bypassing the dropdown
 * entirely — works for both a real symbol and a shape-invalid one, since
 * useAutocomplete's Enter branch fires onSelect with the raw
 * trim+uppercase(query) regardless of whether any listbox option matches it.
 */
async function typeSymbolAndConfirm(page: Page, raw: string): Promise<void> {
    const combobox = portfolioRegion(page).getByRole('combobox', {
        name: TICKER_COMBOBOX_NAME,
    });
    await combobox.fill(raw);
    await combobox.press('Enter');
}

/** Deletes the AAPL row via the UI if present, so every run starts clean regardless of leftovers from a prior run against the persisted e2e Postgres. */
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

test.describe('portfolio holdings CRUD (authed storageState)', () => {
    // Multiple server-action round-trips (save/getAssetInfo, edit, delete)
    // plus 3 full navigations; give ample headroom over the 30s local default
    // under parallel/CI load (mirrors account-delete.spec.ts's full-flow budget).
    test.describe.configure({ timeout: 90_000 });

    test.beforeEach(async ({ page }) => {
        await resetAaplHolding(page);
    });

    test('add on /account, chip + popover reflect it on /AAPL, edit persists, delete clears', async ({
        page,
    }) => {
        const region = portfolioRegion(page);

        // ---- 1. Add a holding on /account ----
        await typeSymbolAndConfirm(page, 'aapl');
        // HoldingForm swaps the autocomplete for a read-only symbol chip once
        // selected; this is the pre-submit proof the field captured "AAPL".
        await expect(region.getByText('AAPL', { exact: true })).toBeVisible();

        // Only the always-present "add" form has these labels at this point
        // (the holdings list is empty post-reset, so no row-edit form exists
        // yet to collide with a plain region-scoped getByLabel).
        await region.getByLabel('수량').fill('10');
        await region.getByLabel('평단').fill('150');
        await region.getByRole('button', { name: '추가', exact: true }).click();

        const row = aaplRow(page);
        await expect(row).toBeVisible({ timeout: SETTLE_TIMEOUT_MS });
        // companyName was persisted from the real (DB-resolved) getAssetInfo call.
        await expect(row).toContainText('Apple Inc.');
        await expect(row).toContainText('10주');
        await expect(row).toContainText('평단 $150');

        // ---- 2. Chip reflects it on the symbol page ----
        await page.goto('/AAPL');
        const chip = page.getByRole('button', { name: /^평단/ });
        await expect(chip).toBeVisible({ timeout: SETTLE_TIMEOUT_MS });
        // Exact match proves the "set" state, not the "평단 설정" unset copy.
        // Generous timeout: this is a fresh hard navigation, so the chip's own
        // client-side holdings fetch (not just hydration) must complete first.
        await expect(chip).toHaveText('평단 $150 · 10주', {
            timeout: SETTLE_TIMEOUT_MS,
        });

        // Popover sanity check (code-split via next/dynamic): opens pre-filled
        // with the same values, proving it reads the identical shared query.
        await chip.click();
        const popover = page.getByRole('dialog', { name: 'AAPL 평단 설정' });
        await expect(popover).toBeVisible();
        await expect(popover.getByLabel('수량')).toHaveValue('10');
        await expect(popover.getByLabel('평단')).toHaveValue('150');
        await page.keyboard.press('Escape');
        await expect(popover).toBeHidden();

        // ---- 3. Edit via the account page ----
        await page.goto('/account');
        await expect(
            page.getByRole('heading', { level: 1, name: '계정 설정' })
        ).toBeVisible({ timeout: SETTLE_TIMEOUT_MS });
        const rowToEdit = aaplRow(page);
        await rowToEdit
            .getByRole('button', { name: 'AAPL 보유종목 수정' })
            .click();

        // Scoped to the row's own inline edit form — the always-present "add"
        // form below also has 수량/평단 labels once a row exists, so an
        // unscoped region-level getByLabel would be a strict-mode violation
        // here (unlike step 1, where the list was still empty).
        await rowToEdit.getByLabel('수량').fill('20');
        await rowToEdit.getByLabel('평단').fill('200');
        await rowToEdit
            .getByRole('button', { name: '저장', exact: true })
            .click();

        await expect(rowToEdit).toContainText('20주', {
            timeout: SETTLE_TIMEOUT_MS,
        });
        await expect(rowToEdit).toContainText('평단 $200');

        // Persists across a reload — reads the committed DB row, not just the
        // client-side React Query cache.
        await page.reload();
        await expect(
            page.getByRole('heading', { level: 1, name: '계정 설정' })
        ).toBeVisible({ timeout: SETTLE_TIMEOUT_MS });
        const rowAfterReload = aaplRow(page);
        await expect(rowAfterReload).toContainText('20주', {
            timeout: SETTLE_TIMEOUT_MS,
        });
        await expect(rowAfterReload).toContainText('평단 $200');

        // ---- 4. Delete ----
        await rowAfterReload
            .getByRole('button', { name: 'AAPL 보유종목 삭제' })
            .click();
        await rowAfterReload.getByRole('button', { name: '삭제 확정' }).click();
        await expect(rowAfterReload).toHaveCount(0, {
            timeout: SETTLE_TIMEOUT_MS,
        });
        await expect(region.getByText(EMPTY_STATE_TEXT)).toBeVisible();
    });

    test('adding a shape-invalid symbol is rejected with a visible error', async ({
        page,
    }) => {
        const region = portfolioRegion(page);

        // A space is outside SYMBOL_EDGE_RE (shared/config/ticker.ts), so
        // validateHoldingInput rejects this purely on shape — no existence
        // check, no DB write, independent of FMP availability. This is the
        // only deterministic "rejected" path: a shape-valid but never-seeded
        // symbol would still be ACCEPTED (getAssetInfo throwing on missing
        // FMP config is the documented degrade-tolerant path, design §5).
        await typeSymbolAndConfirm(page, 'aa pl');
        await expect(region.getByText('AA PL', { exact: true })).toBeVisible();

        await region.getByLabel('수량').fill('1');
        await region.getByLabel('평단').fill('1');
        await region.getByRole('button', { name: '추가', exact: true }).click();

        await expect(
            region.getByText('올바른 종목 코드를 입력해 주세요.')
        ).toBeVisible({ timeout: SETTLE_TIMEOUT_MS });

        // Nothing was persisted for the rejected symbol.
        await expect(
            region.getByRole('listitem').filter({ hasText: 'AA PL' })
        ).toHaveCount(0);
    });
});
