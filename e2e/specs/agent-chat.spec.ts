import { test, expect } from '../support/fixtures';
import { AUTH_STORAGE_STATE } from '../support/authUser';

const AI = 'http://ai.localhost:4300';
const MAIN = 'http://localhost:4300';

test.describe('SiglensAI agent chat', () => {
    test.use({ storageState: AUTH_STORAGE_STATE }); // main-host session only

    test('메인 로그인 세션이 ai 호스트로 SSO 핸드오프되고, 대화·툴·저장·재생성이 동작한다', async ({
        page,
    }) => {
        await page.goto(`${AI}/`);
        // main-host cookies don't cross to ai.localhost, so this round-trips
        // through the SSO handoff (start -> main /api/auth/handoff -> consume)
        // before landing back on the ai host.
        await expect(page).toHaveURL(new RegExp(`^${AI}/(ko/)?$`));
        await expect(
            page.getByRole('heading', { name: /SiglensAI/ })
        ).toBeVisible();
        await page
            .getByRole('textbox', { name: /메시지 입력/ })
            .fill('AAPL 지금 얼마야');
        await page.keyboard.press('Enter');
        await expect(page.getByText(/get_quote/)).toBeVisible();
        await expect(page.getByText(/\[E2E agent\]/)).toBeVisible();
        // The text frame arrives from the provider mid-turn, but the assistant row
        // is only persisted after `runAgentTurn` returns. `다시 생성` renders exactly
        // when the stream is done, so waiting for it is the first point where a
        // reload is guaranteed to find the turn in the database.
        await expect(
            page.getByRole('button', { name: /다시 생성/ })
        ).toBeVisible();
        await expect(page).toHaveURL(/\/c\/[0-9a-f-]{36}$/);
        await page.reload();
        await expect(page.getByText(/\[E2E agent\]/)).toBeVisible();
        await expect(
            page
                .getByRole('navigation', { name: '대화 목록' })
                .getByRole('link', { name: /AAPL 지금 얼마야/ })
        ).toBeVisible();
        await page.getByRole('button', { name: /다시 생성/ }).click();
        // A count of 1 alone proves nothing: an HTTP-stage failure restores the
        // previous bubble verbatim, so success and rollback look identical. The
        // rollback also raises the error banner, and a regenerated turn re-runs the
        // tool — assert both, and don't assert the transient 0 (the fake provider
        // can refill it before the first poll).
        await expect(page.getByText(/\[E2E agent\]/)).toHaveCount(1);
        await expect(page.getByText(/get_quote/)).toHaveCount(1);
        await expect(page.getByRole('alert')).toHaveCount(0);
    });

    test('비로그인: ?sso=none 랜딩과 로그인 CTA, 스트림 401', async ({
        browser,
    }) => {
        const context = await browser.newContext({
            storageState: { cookies: [], origins: [] },
        });
        const page = await context.newPage();
        await page.goto(`${AI}/`);
        await expect(page).toHaveURL(/sso=none/);
        const cta = page.getByRole('link', {
            name: /siglens 계정으로 로그인/,
        });
        await expect(cta).toHaveAttribute(
            'href',
            /localhost:4300\/(ko\/)?login\?next=/
        );
        const res = await context.request.post(`${AI}/api/ai/chat/stream`, {
            data: { message: 'x' },
        });
        expect(res.status()).toBe(401);
        await context.close();
    });

    test('메인 호스트 /ai 는 ai 호스트로 301', async ({ request }) => {
        const res = await request.get(`${MAIN}/ai/ko`, { maxRedirects: 0 });
        expect(res.status()).toBe(301);
        expect(res.headers().location).toBe(`${AI}/ko`);
    });
});
