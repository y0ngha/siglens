import { test, expect } from '../support/fixtures';
import type { Locator, Page } from '@playwright/test';

/**
 * Authed Tier 2 spec — exercises the BYOK API-key CRUD on /account
 * (features/api-key-management/ui/ApiKeySection.tsx) end to end against the real
 * local Postgres, with REAL AES-256-GCM encryption (LLM_API_KEY_ENCRYPTION_KEY
 * from .env.e2e) running in the save path.
 *
 * Runs in the `authed` Playwright project: the shared storageState
 * (.auth/user.json, the seeded e2e-auth-user) authenticates the request through
 * proxy.ts and account/page.tsx's getCurrentUser re-check. This spec only
 * read/writes that user's `userApiKeys` rows — it never deletes the user — so it
 * leaves the shared storageState intact for the other account specs.
 *
 * DOM contract (verified against the real ApiKeySection.tsx, NOT the mocked
 * integration test): each provider renders a card whose header shows the
 * provider label (Anthropic → "Claude (Anthropic)") plus a 미등록/등록됨 badge.
 * An unregistered (or 재등록-editing) provider exposes a save form with an
 * `<label>API 키` input ("Claude (Anthropic) API 키") and a 저장 button; a
 * registered provider shows 재등록 + 삭제 buttons. The card's React key encodes
 * `${provider}-${isRegistered}`, so saving/deleting (each runs
 * revalidatePath('/account')) remounts the card and flips the badge without a
 * manual reload.
 *
 * Re-runnability: the Task-1 containers persist Postgres across runs, so the
 * Anthropic key may already be 등록됨 from a prior run. beforeEach normalizes the
 * provider back to 미등록 (UI delete if present) so the test always starts from a
 * known-clean state and the register→delete assertions hold deterministically.
 */
const PROVIDER_LABEL = 'Claude (Anthropic)';
const DUMMY_KEY = 'sk-ant-e2e-dummy';

/** The provider card scoped by its label heading's nearest card container. */
function anthropicCard(page: Page): Locator {
    // ProviderCard renders the label in a <span>; the card is its closest
    // rounded container. Filtering the card list by the label text is more
    // robust than positional indexing if provider order ever changes.
    return page
        .locator('div.rounded-xl')
        .filter({ hasText: PROVIDER_LABEL })
        .first();
}

/** True once the Anthropic card shows the 등록됨 badge (registered). */
async function isRegistered(page: Page): Promise<boolean> {
    return anthropicCard(page).getByText('등록됨', { exact: true }).isVisible();
}

/**
 * Click a state-changing button (저장/삭제) and wait for the card's "진행 중"
 * pending state to leave the Anthropic card's DOM subtree.
 *
 * The card's React key encodes `${provider}-${isRegistered}`, so
 * `revalidatePath('/account')` causes a full card remount — removing the
 * `저장 중…`/`삭제 중…` disabled button entirely. Waiting for that button to
 * detach from the Anthropic card is the earliest reliable signal that the RSC
 * re-render has settled and React has committed the new badge state to DOM.
 *
 * This is more reliable than `waitForResponse` (fires on headers, not when
 * the streaming RSC body is fully consumed) and avoids `response.body()` which
 * throws on streaming responses already consumed by the browser.
 */
async function clickAndAwaitActionSettle(
    card: Locator,
    button: Locator
): Promise<void> {
    await button.click();
    // After click the SubmitButton renders as disabled ("저장 중…"/"삭제 중…").
    // Wait for it to appear first, then wait for it to detach — which happens
    // when revalidatePath('/account') completes and React remounts the card
    // with the new key (`${provider}-${isRegistered}`). This two-phase wait
    // gives 30s headroom for slow AES encrypt + Postgres write + RSC stream.
    const pendingBtn = card.locator('button[disabled]');
    await pendingBtn.waitFor({ state: 'visible', timeout: 10_000 });
    await pendingBtn.waitFor({ state: 'detached', timeout: 30_000 });
}

/** Delete the Anthropic key through the UI and wait for the 미등록 badge. */
async function deleteAnthropicKey(page: Page): Promise<void> {
    const card = anthropicCard(page);
    await clickAndAwaitActionSettle(
        card,
        card.getByRole('button', { name: '삭제', exact: true })
    );
    await expect(card.getByText('미등록', { exact: true })).toBeVisible({
        timeout: 15_000,
    });
}

test.describe('account API key CRUD (authed storageState)', () => {
    // Two server-action round-trips (save w/ AES encrypt, delete) plus the
    // revalidate-driven remount; give headroom over 30s under parallel load.
    test.describe.configure({ timeout: 60_000 });

    test.beforeEach(async ({ page }) => {
        await page.goto('/account');
        await expect(
            page.getByRole('heading', { level: 1, name: '계정 설정' })
        ).toBeVisible({ timeout: 15_000 });

        // Normalize to 미등록 so register→delete starts from a clean slate even
        // if a prior run (persistent DB) left the Anthropic key registered.
        if (await isRegistered(page)) {
            await deleteAnthropicKey(page);
        }
    });

    test('register an Anthropic key (등록됨) then delete it (미등록)', async ({
        page,
    }) => {
        const card = anthropicCard(page);

        // Precondition from beforeEach: starts unregistered.
        await expect(card.getByText('미등록', { exact: true })).toBeVisible();

        // --- Register: fill the API key input + 저장. ---
        // The input is labelled "Claude (Anthropic) API 키" (aria-label).
        // Target the textbox role specifically: the show/hide toggle button's
        // aria-label ("API 키 보이기") also matches a bare /API 키/ pattern.
        await card.getByRole('textbox', { name: /API 키/ }).fill(DUMMY_KEY);
        // Wait for the card to remount (RSC re-render complete) before
        // asserting the badge. revalidatePath('/account') replaces the entire
        // card subtree; the pending disabled button detaching is the earliest
        // reliable DOM signal that React has committed the new state.
        await clickAndAwaitActionSettle(
            card,
            card.getByRole('button', { name: '저장', exact: true })
        );

        // revalidatePath('/account') flips the badge after the (real AES
        // encryption) save resolves; the card key change remounts it as
        // registered.
        await expect(card.getByText('등록됨', { exact: true })).toBeVisible({
            timeout: 15_000,
        });
        await expect(card.getByText('미등록', { exact: true })).toHaveCount(0);

        // --- Delete: 삭제 → back to 미등록. ---
        await deleteAnthropicKey(page);
        await expect(card.getByText('등록됨', { exact: true })).toHaveCount(0);
    });
});
