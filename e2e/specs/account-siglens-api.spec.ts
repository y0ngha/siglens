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
/** OpenAI byok 등급 모델 — 이 사용자는 OpenAI 키를 등록하지 않은 상태에서 시작한다. */
const UNKEYED_MODEL = 'gpt-6-astra';
const SETTLE_TIMEOUT_MS = 45_000;
const BYOK_REQUIRED_TITLE = 'AI 모델 키를 먼저 등록해 주세요';
const CREATE_ANYWAY = '데이터 도구만 쓸게요, 키 만들기';

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

        // 시드 사용자는 BYOK 키가 없다 — 발급 전에 확인 모달이 먼저 뜨고, 아직 키는 만들어지지 않았다.
        const dialog = page.getByRole('dialog', { name: BYOK_REQUIRED_TITLE });
        await expect(dialog).toBeVisible();
        await expect(
            section.locator('li[data-testid^="siglens-api-key-row-"]')
        ).toHaveCount(0);
        await dialog.getByRole('button', { name: CREATE_ANYWAY }).click();
        await expect(dialog).toBeHidden();

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

            // run_fresh_analysis는 BYOK 전용으로 열려 있다. LLM은 부르지 않는 거절 경로만 본다:
            // 모델도 기본 모델도 없으면 400, 로스터에 없는 모델은 스키마 거절, 캐시가 비고 사용자
            // 키가 없으면 400 byok_key_required(서버 키로 넘어가지 않는다). OpenAI 모델을 쓰는 이유는
            // 같은 사용자의 account-api-key 스펙이 Anthropic 키를 등록·삭제하기 때문이다.
            const noModel = await api.post('/api/v1/tools/run_fresh_analysis', {
                headers: bearer,
                data: { symbol: 'AAPL', kind: 'technical' },
            });
            expect(noModel.status()).toBe(400);
            expect((await noModel.json()).error.code).toBe('model_required');

            const badModel = await api.post(
                '/api/v1/tools/run_fresh_analysis',
                {
                    headers: bearer,
                    data: {
                        symbol: 'AAPL',
                        kind: 'technical',
                        model: 'gpt-99-imaginary',
                    },
                }
            );
            expect(badModel.status()).toBe(400);
            expect((await badModel.json()).error.code).toBe('invalid_args');

            const noKey = await api.post('/api/v1/tools/run_fresh_analysis', {
                headers: bearer,
                data: {
                    symbol: 'AAPL',
                    kind: 'technical',
                    model: UNKEYED_MODEL,
                },
            });
            expect(noKey.status()).toBe(400);
            const noKeyBody = await noKey.json();
            expect(noKeyBody.error.code).toBe('byok_key_required');
            expect(noKeyBody.error.details).toEqual({ provider: 'openai' });
            // 거절 경로는 ai 버킷을 쓰지 않는다 — data 버킷 한도 헤더만 있다.
            expect(noKey.headers()['x-ratelimit-limit']).toBe('60');

            expect(
                (
                    await (
                        await api.get('/api/v1/me', { headers: bearer })
                    ).json()
                ).data.defaultModel
            ).toBeNull();

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

    test('BYOK 키가 없을 때 "AI 모델 키 등록하러 가기"는 BYOK 섹션으로 스크롤·포커스하고 키를 만들지 않는다', async ({
        page,
    }) => {
        const section = page.getByTestId('siglens-api-key-section');
        await section.getByLabel('키 이름').fill(KEY_NAME);
        await section.getByRole('button', { name: '새 키 만들기' }).click();

        const dialog = page.getByRole('dialog', { name: BYOK_REQUIRED_TITLE });
        await expect(dialog).toBeVisible();
        await dialog
            .getByRole('button', { name: 'AI 모델 키 등록하러 가기' })
            .click();

        await expect(dialog).toBeHidden();
        const byok = page.locator('#byok-keys');
        await expect(byok).toBeFocused();
        await expect(byok).toBeInViewport();
        await expect(
            section.locator('li[data-testid^="siglens-api-key-row-"]')
        ).toHaveCount(0);
        await expect(section.getByTestId('siglens-api-key-raw')).toHaveCount(0);
    });

    test('API 기본 모델: BYOK 키를 등록한 provider의 모델만 고를 수 있고 /me에 반영된다', async ({
        page,
        baseURL,
    }) => {
        test.setTimeout(120_000);
        const openai = page.getByTestId('api-key-card-openai');
        const modelSection = page.getByTestId('siglens-api-default-model');
        const status = modelSection.getByRole('status');

        // 이전 실행이 남긴 OpenAI 키가 있으면 지워 깨끗한 상태에서 시작한다.
        if (await openai.getByText('등록됨', { exact: true }).isVisible()) {
            await openai
                .getByRole('button', { name: '삭제', exact: true })
                .click();
            await expect(
                openai.getByText('미등록', { exact: true })
            ).toBeVisible({
                timeout: SETTLE_TIMEOUT_MS,
            });
        }

        // 1) OpenAI 키가 없으면 OpenAI 모델은 선택지에 없다(키가 하나도 없어 선택기 자체가 안내로 대체된다).
        await expect(modelSection).toBeVisible();
        await expect(
            modelSection.getByRole('button', { name: /기본 모델/ })
        ).toHaveCount(0);

        // 2) OpenAI 키를 등록하면 그 provider의 모델이 listbox에 나타난다.
        await openai
            .getByRole('textbox', { name: /API 키/ })
            .fill('sk-e2e-dummy');
        await openai.getByRole('button', { name: '저장', exact: true }).click();
        await expect(openai.getByText('등록됨', { exact: true })).toBeVisible({
            timeout: SETTLE_TIMEOUT_MS,
        });
        const trigger = modelSection.getByRole('button', { name: /기본 모델/ });
        await expect(trigger).toBeVisible({ timeout: SETTLE_TIMEOUT_MS });
        await trigger.click();
        const listbox = page.getByRole('listbox', { name: '기본 모델' });
        await expect(
            listbox.getByRole('option', { name: /GPT-6 Astra/ })
        ).toHaveCount(1, { timeout: SETTLE_TIMEOUT_MS });
        // 키를 등록하지 않은 회사(Anthropic)의 모델은 선택지에 없다.
        await expect(
            listbox.getByRole('option', { name: /Claude Haiku/ })
        ).toHaveCount(0);

        // 3) 선택·저장 -> 상태 문구.
        await listbox.getByRole('option', { name: /GPT-6 Astra/ }).click();
        await expect(listbox).toBeHidden();
        await expect(trigger).toContainText('GPT-6 Astra');
        await modelSection
            .getByRole('button', { name: '저장', exact: true })
            .click();
        await expect(status).toHaveText('기본 모델을 저장했어요.', {
            timeout: SETTLE_TIMEOUT_MS,
        });

        // 4) API에서 보인다.
        const section = page.getByTestId('siglens-api-key-section');
        await section.getByLabel('키 이름').fill(KEY_NAME);
        await section.getByRole('button', { name: '새 키 만들기' }).click();
        const raw = section.getByTestId('siglens-api-key-raw');
        await expect(raw).toBeVisible({ timeout: SETTLE_TIMEOUT_MS });
        const rawKey = (await raw.textContent())?.trim() ?? '';

        const api = await playwrightRequest.newContext({ baseURL });
        try {
            const me = await api.get('/api/v1/me', {
                headers: { Authorization: `Bearer ${rawKey}` },
            });
            const body = (await me.json()).data;
            expect(body.defaultModel).toBe('gpt-6-astra');
            expect(body.byokProviders).toContain('openai');
        } finally {
            await api.dispose();
        }

        // 5) 정리: 설정 해제 -> 키 삭제 -> API 키 폐기 (다음 실행·다른 스펙에 영향이 없게).
        await trigger.click();
        await page
            .getByRole('listbox', { name: '기본 모델' })
            .getByRole('option', { name: /설정 안 함/ })
            .click();
        await modelSection
            .getByRole('button', { name: '저장', exact: true })
            .click();
        await expect(status).toHaveText('기본 모델 설정을 해제했어요.', {
            timeout: SETTLE_TIMEOUT_MS,
        });
        await openai.getByRole('button', { name: '삭제', exact: true }).click();
        await expect(openai.getByText('미등록', { exact: true })).toBeVisible({
            timeout: SETTLE_TIMEOUT_MS,
        });
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
        expect(body).toContain('### `run_fresh_analysis`');
        expect(body).toContain('- `model` (');
        expect(body).toContain('(BYOK)');
        await expect(
            page.getByRole('link', { name: 'Skill 내려받기' })
        ).toHaveAttribute('href', '/api/v1/skill');
    });
});
