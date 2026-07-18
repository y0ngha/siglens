import { test, expect } from '../support/fixtures';
import type { Page } from '@playwright/test';

/**
 * Model-gate spec: proves the guest-reachable branches of the symbol-header
 * AI-model selector against the production build (E2E_TEST=1) with zero
 * external browser requests (the support/fixtures network guard enforces this).
 *
 * Architecture (verified against the real DOM + the @y0ngha/siglens-core
 * package runtime, NOT the unit/integration mocks in
 * src/__integration__/modelSelectorFlow.test.tsx):
 *
 *   - The selector no longer sits directly in the symbol layout header. This
 *     PR consolidated it behind a "분석 설정" gear popover
 *     (widgets/analysis/AnalysisSettingsMenu, mounted from SymbolLayoutHeader)
 *     together with the reasoning toggle. The gear's own trigger is a
 *     `<button>` whose accessible name starts with `분석 설정 · 현재 모델: {label}`
 *     (e.g. "분석 설정 · 현재 모델: DeepSeek Flash"; a " (변경됨)" suffix is appended
 *     once reasoning is on or a non-default model is selected). The popover is
 *     closed by default, so every test below opens it first
 *     (`openAnalysisSettings`) before it can locate the nested ModelSelector's
 *     `<button aria-label="AI 분석 모델 선택">` trigger (`aria-haspopup="listbox"`);
 *     clicking THAT opens a `role="listbox"` (aria-label "AI 분석 모델 목록") of
 *     `role="option"` rows. Each option shows a short label + the model's full
 *     name, and non-free models carry a "PRO" badge. On `/AAPL` this gear's
 *     ModelSelector is the ONLY one mounted — the chat-panel one only mounts
 *     when the floating chat is opened, which a guest does not do here — so an
 *     aria-label lookup is unambiguous.
 *
 *   - allowedModels is the SAME full list for every tier
 *     (getAllowedModels(tier) is tier-independent in this build): premium
 *     models are NOT hidden for guests, they are shown and gated *on select*
 *     by useModelGate (features/premium-gate/hooks/useModelGate). For a guest
 *     (no session ⇒ currentUserAction returns null) selecting a non-free model
 *     opens PremiumModelGateModal in `auth` mode and does NOT apply the model.
 *
 *   - Free vs premium (from siglens-core isFreeModel — note several Claude/GPT
 *     models are FREE here):
 *       free   : gemini-2.5-flash-lite (default), gemini-2.5-flash,
 *                claude-haiku-4-5, gpt-5-mini
 *       premium: gemini-2.5-pro, claude-sonnet-4-6, claude-opus-4-7,
 *                gemini-3.1-pro-preview, gemini-3-flash-preview, gpt-5.4, gpt-5.5
 *     The default/selected model is deepseek-v4-flash → trigger shows
 *     "DeepSeek Flash". We exercise the premium branch with "Claude Sonnet 4.6"
 *     (label "Sonnet", non-free ⇒ guest auth gate).
 *
 *   - The gate modal is a `role="dialog"` (aria-labelledby the
 *     "프리미엄 모델 사용 안내" heading in auth mode) with a `<Link role="link">`
 *     CTA named "회원가입 하러 가기" and a "닫기" close button; Escape / backdrop
 *     also dismiss it (useEscapeKey + backdrop onClick).
 *
 *   - Selection persists to localStorage key `siglens:selected-analysis-model`
 *     (shared/lib/storageKeys, via useSelectedModel); a gated (blocked)
 *     selection must NOT write the premium id there.
 *
 * DEFERRED to Tier 2 (require an authenticated session / storageState — this
 * worktree has no login setup):
 *   - premium + pro tier → allowed (no modal)
 *   - premium + non-pro logged-in + no BYOK key → `byok` gate modal
 * These are marked with test.skip below; do NOT log in via the UI here.
 */

const SELECTOR_TRIGGER_NAME = 'AI 분석 모델 선택';
const SELECTOR_LISTBOX_NAME = 'AI 분석 모델 목록';
const FREE_DEFAULT_LABEL = 'DeepSeek Flash'; // deepseek-v4-flash — the free default model's trigger label
// A free, non-default option. Matched by EXACT accessible name (label +
// fullName), because the substring "Gemini 2.5 Flash" also occurs inside the
// default option's name "Flash Lite Gemini 2.5 Flash Lite".
const FREE_OPTION_ACCESSIBLE_NAME = 'Flash Gemini 2.5 Flash';
const PREMIUM_OPTION_FULLNAME = 'Claude Sonnet 4.6'; // non-free ⇒ guest auth gate
const PREMIUM_MODEL_ID = 'claude-sonnet-4-6';
const MODEL_STORAGE_KEY = 'siglens:selected-analysis-model';
const AUTH_GATE_TITLE = '프리미엄 모델 사용 안내';
const AUTH_GATE_CTA = '회원가입 하러 가기';

/**
 * Opens the "분석 설정" gear popover (AnalysisSettingsMenu) that now houses
 * the ModelSelector — it is closed by default, so every test needs this
 * before it can locate the `AI 분석 모델 선택` trigger nested inside it.
 */
async function openAnalysisSettings(page: Page) {
    await page.getByRole('button', { name: /^분석 설정/ }).click();
}

test.describe('model gate (guest)', () => {
    test('selecting a free model applies without a gate modal', async ({
        page,
    }) => {
        await page.goto('/AAPL');
        await openAnalysisSettings(page);

        // Default selection is the free DeepSeek Flash — its label shows on
        // the trigger before we touch anything.
        const trigger = page.getByRole('button', {
            name: SELECTOR_TRIGGER_NAME,
        });
        await expect(trigger).toContainText(FREE_DEFAULT_LABEL);

        // Open the popover and pick another FREE model (Gemini 2.5 Flash).
        await trigger.click();
        const listbox = page.getByRole('listbox', {
            name: SELECTOR_LISTBOX_NAME,
        });
        await expect(listbox).toBeVisible();
        // Exact name match — "Flash Lite" option's name contains this substring,
        // so an exact lookup is required to disambiguate.
        await listbox
            .getByRole('option', {
                name: FREE_OPTION_ACCESSIBLE_NAME,
                exact: true,
            })
            .click();

        // No gate modal appears for a free model — scope the dialog check to
        // exclude the "분석 설정" gear popover's own `role="dialog"`
        // (AnalysisSettingsMenu), which stays open for the rest of this test
        // now that ModelSelector lives inside it (only its internal listbox
        // closes on selection, not the gear).
        await expect(
            page.getByRole('dialog').filter({ hasNotText: '분석 설정' })
        ).toHaveCount(0);
        // … the popover closes …
        await expect(listbox).toBeHidden();
        // … and the free selection actually applied: the trigger now shows the
        // new model's label exactly (not "Flash Lite"), and the persisted
        // localStorage value reflects it.
        await expect(trigger).toHaveText(/\bFlash\b/);
        await expect(trigger).not.toContainText(FREE_DEFAULT_LABEL);
        await expect
            .poll(() =>
                page.evaluate(
                    key => localStorage.getItem(key),
                    MODEL_STORAGE_KEY
                )
            )
            .toBe('gemini-2.5-flash');
    });

    test('selecting a premium model as a guest opens the auth gate and blocks the selection', async ({
        page,
    }) => {
        await page.goto('/AAPL');
        await openAnalysisSettings(page);

        const trigger = page.getByRole('button', {
            name: SELECTOR_TRIGGER_NAME,
        });
        await expect(trigger).toContainText(FREE_DEFAULT_LABEL);

        await trigger.click();
        const listbox = page.getByRole('listbox', {
            name: SELECTOR_LISTBOX_NAME,
        });
        await expect(listbox).toBeVisible();

        // The premium option carries a "PRO" badge — confirm we are clicking a
        // gated (non-free) row, not a free one.
        const premiumOption = listbox
            .getByRole('option')
            .filter({ hasText: PREMIUM_OPTION_FULLNAME });
        await expect(premiumOption).toContainText('PRO');
        await premiumOption.click();

        // useModelGate sees no session ⇒ auth gate. The modal is a dialog whose
        // accessible name is the auth title, and it carries the signup CTA.
        const gate = page.getByRole('dialog', { name: AUTH_GATE_TITLE });
        await expect(gate).toBeVisible();
        await expect(
            gate.getByRole('link', { name: AUTH_GATE_CTA })
        ).toBeVisible();

        // The gate BLOCKED the selection: the trigger still shows the free
        // default, and the premium id was never persisted to localStorage.
        await expect(trigger).toContainText(FREE_DEFAULT_LABEL);
        const stored = await page.evaluate(
            key => localStorage.getItem(key),
            MODEL_STORAGE_KEY
        );
        expect(stored).not.toBe(PREMIUM_MODEL_ID);
    });

    test('dismissing the auth gate (Escape) leaves the free model in place', async ({
        page,
    }) => {
        await page.goto('/AAPL');
        await openAnalysisSettings(page);

        const trigger = page.getByRole('button', {
            name: SELECTOR_TRIGGER_NAME,
        });
        await trigger.click();
        await page
            .getByRole('listbox', { name: SELECTOR_LISTBOX_NAME })
            .getByRole('option')
            .filter({ hasText: PREMIUM_OPTION_FULLNAME })
            .click();

        const gate = page.getByRole('dialog', { name: AUTH_GATE_TITLE });
        await expect(gate).toBeVisible();

        // Escape dismisses the gate (useEscapeKey). NOTE: PremiumModelGateModal
        // is rendered by the symbol layout header, OUTSIDE the "분석 설정" gear
        // popover — but AnalysisSettingsMenu ALSO owns a document-level Escape
        // listener (to close the gear itself) for as long as it is open, and
        // neither listener stops the other's propagation. So this single
        // Escape press collapses BOTH layers: the gate dialog closes AND the
        // gear popover closes (which unmounts the nested ModelSelector, incl.
        // `trigger`). Re-open the gear afterwards to inspect the model
        // selection that survived the gate.
        await page.keyboard.press('Escape');
        await expect(gate).toBeHidden();

        await openAnalysisSettings(page);
        await expect(trigger).toContainText(FREE_DEFAULT_LABEL);
        const stored = await page.evaluate(
            key => localStorage.getItem(key),
            MODEL_STORAGE_KEY
        );
        expect(stored).not.toBe(PREMIUM_MODEL_ID);
    });

    // --- DEFERRED to Tier 2 (need an authenticated session / storageState) ---

    test.skip('premium model + pro tier is allowed without a gate', async () => {
        // Tier 2: requires a logged-in pro user (storageState). useModelGate
        // takes the `currentUser.tier === 'pro'` branch → onAllow, no modal.
    });

    test.skip('premium model + non-pro logged-in + no BYOK key opens the byok gate', async () => {
        // Tier 2: requires a logged-in non-pro user with no registered provider
        // key (storageState). useModelGate falls through to the `byok` gate
        // ("API 키 등록 필요"), not the auth gate exercised above.
    });
});
