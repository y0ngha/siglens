import { request as playwrightRequest, type Page } from '@playwright/test';
import { test, expect } from '../support/fixtures';

/**
 * Authed Tier 2 spec — SigLens public API key lifecycle on /account
 * (features/siglens-api-key-management) against the real local Postgres + Redis:
 * issue a key through the UI, call `/api/v1/*` with it from a cookie-less client,
 * revoke it, and see the same call turn into 401.
 *
 * The API client is a SEPARATE request context with no storageState: the seeded
 * user's session cookie must not be able to authenticate `/api/v1/*` (Bearer only),
 * and a cookie-less client is how a real agent calls it.
 *
 * Runs in the `authed` project (matches `account-*.spec.ts`). It only creates and
 * revokes this user's `siglens_api_keys` rows and never deletes the user, so the
 * shared storageState stays intact for the other account specs. beforeEach revokes
 * leftovers from an earlier failed run so the 5-key cap can't accumulate.
 */
const KEY_NAME = 'e2e-agent';
const SETTLE_TIMEOUT_MS = 45_000;

async function revokeAllKeys(page: Page): Promise<void> {
    const section = page.getByTestId('siglens-api-key-section');
    await expect(section).toBeVisible({ timeout: SETTLE_TIMEOUT_MS });
    for (;;) {
        const revoke = section
            .getByRole('button', { name: /키 폐기$/ })
            .first();
        if (!(await revoke.isVisible())) return;
        const rowsBefore = await section
            .locator('li[data-testid^="siglens-api-key-row-"]')
            .count();
        await revoke.click();
        await section.getByRole('button', { name: '폐기하기' }).click();
        await expect(
            section.locator('li[data-testid^="siglens-api-key-row-"]')
        ).toHaveCount(rowsBefore - 1, { timeout: SETTLE_TIMEOUT_MS });
    }
}

test.describe('SigLens API keys', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/account');
        await revokeAllKeys(page);
    });

    test('키 발급 -> Bearer 호출 200 -> 폐기 -> 같은 호출 401', async ({
        page,
        baseURL,
    }) => {
        const section = page.getByTestId('siglens-api-key-section');
        await section.getByLabel('키 이름').fill(KEY_NAME);
        await section.getByRole('button', { name: '새 키 만들기' }).click();

        const raw = section.getByTestId('siglens-api-key-raw');
        await expect(raw).toBeVisible({ timeout: SETTLE_TIMEOUT_MS });
        const rawKey = (await raw.textContent())?.trim() ?? '';
        expect(rawKey).toMatch(/^slk_[0-9A-Za-z]{40}$/);
        await expect(section.getByText(KEY_NAME)).toBeVisible();

        const api = await playwrightRequest.newContext({ baseURL });
        const bearer = { Authorization: `Bearer ${rawKey}` };
        try {
            const me = await api.get('/api/v1/me', { headers: bearer });
            expect(me.status()).toBe(200);
            expect(me.headers()['cache-control']).toBe('no-store');
            expect((await me.json()).data.key.name).toBe(KEY_NAME);

            const search = await api.post('/api/v1/tools/search_ticker', {
                headers: bearer,
                data: { query: 'AAPL' },
            });
            expect(search.status()).toBe(200);
            expect(search.headers()['x-ratelimit-limit']).toBe('60');
            expect((await search.json()).meta.tool).toBe('search_ticker');

            // 제외된 도구는 키가 있어도 닿지 않는다. (web_search는 E2E에서 실행기 목록 자체가 빠뜨려
            // 이 단언이 공회전하므로 쓰지 않는다 — run_fresh_analysis는 E2E에서도 실행기에 있다.)
            const excluded = await api.post(
                '/api/v1/tools/run_fresh_analysis',
                {
                    headers: bearer,
                    data: { symbol: 'AAPL', kind: 'technical' },
                }
            );
            expect(excluded.status()).toBe(404);

            // 세션 쿠키만으로는 API를 쓸 수 없다.
            expect((await page.request.get('/api/v1/me')).status()).toBe(401);

            await section
                .getByRole('button', { name: `${KEY_NAME} 키 폐기` })
                .click();
            await section.getByRole('button', { name: '폐기하기' }).click();
            await expect(section.getByText('키를 폐기했어요.')).toBeVisible({
                timeout: SETTLE_TIMEOUT_MS,
            });

            const after = await api.post('/api/v1/tools/search_ticker', {
                headers: bearer,
                data: { query: 'AAPL' },
            });
            expect(after.status()).toBe(401);
            expect((await after.json()).error.code).toBe('invalid_api_key');
        } finally {
            await api.dispose();
        }
    });

    test('Skill 파일을 내려받을 수 있다', async ({ page }) => {
        await page.goto('/account');
        const response = await page.request.get('/api/v1/skill');
        expect(response.status()).toBe(200);
        expect(response.headers()['content-type']).toContain('text/markdown');
        const body = await response.text();
        expect(body).toContain('name: siglens');
        expect(body).toContain('### `search_ticker`');
        expect(body).not.toContain('### `web_search`');
        expect(body).not.toContain('### `run_fresh_analysis`');
        await expect(
            page.getByRole('link', { name: 'Skill 내려받기' })
        ).toHaveAttribute('href', '/api/v1/skill');
    });
});
