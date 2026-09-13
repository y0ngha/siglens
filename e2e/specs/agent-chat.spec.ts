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
        // Task S3: the ai host renders the shared main `Header` (not the old
        // bespoke `AiHeader`) — its `SiglensAI` nav pill shows `aria-current`
        // when `useHrefBase() !== ''`, and the theme toggle rides along with
        // the rest of the shared chrome.
        const banner = page.getByRole('banner');
        await expect(
            banner.getByRole('link', { name: 'SiglensAI Beta' })
        ).toHaveAttribute('aria-current', 'page');
        await expect(
            banner.getByRole('button', { name: /테마/ })
        ).toBeVisible();
        await expect(
            page.getByRole('heading', { name: /SiglensAI/ })
        ).toBeVisible();
        await page
            .getByRole('textbox', { name: /메시지 입력/ })
            .fill('AAPL 지금 얼마야');
        await page.keyboard.press('Enter');
        // The tool line names the lookup in the reader's language — never the
        // internal function name.
        await expect(page.getByText(/시세 확인/)).toBeVisible();
        await expect(page.getByText(/get_quote/)).toHaveCount(0);
        await expect(page.getByText(/\[E2E agent\]/)).toBeVisible();
        // The symbol the answer read links back to its siglens.io page.
        await expect(
            page.getByRole('link', { name: /siglens에서 AAPL 보기/ })
        ).toHaveAttribute('href', `${MAIN}/AAPL`);
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
        // Scope to THIS conversation's id: CI retries reuse the same database, so a
        // retried run finds one leftover conversation per earlier attempt, all with
        // the same derived title. Matching by title alone hit strict mode with 2 and
        // then 3 links.
        const conversationId = new URL(page.url()).pathname.split('/c/')[1]!;
        await expect(
            page
                .getByRole('navigation', { name: '대화 목록' })
                .locator(`a[href$="/c/${conversationId}"]`)
        ).toBeVisible();
        await page.getByRole('button', { name: /다시 생성/ }).click();
        // A count of 1 alone proves nothing: an HTTP-stage failure restores the
        // previous bubble verbatim, so success and rollback look identical. The
        // rollback also raises the error banner, and a regenerated turn re-runs the
        // tool — assert both, and don't assert the transient 0 (the fake provider
        // can refill it before the first poll).
        await expect(page.getByText(/\[E2E agent\]/)).toHaveCount(1);
        await expect(page.getByText(/시세 확인/)).toHaveCount(1);
        // Next renders an always-present, always-empty route announcer with
        // role="alert", so a bare count of 0 can never pass. Only a banner with text
        // is ours.
        await expect(
            page.getByRole('alert').filter({ hasText: /\S/ })
        ).toHaveCount(0);
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

    // Task S3: the shared `Header`'s `AiNavLink` is a plain cross-origin `<a>`
    // (not a `LocaleLink`) pointing at the ai host — a plain HTML fetch of the
    // main host is enough to prove it is wired, no `ai.localhost` DNS needed.
    // The logo lockup shows only "AI"; the product name is its accessible name.
    test('메인 호스트 헤더에 ai 호스트로 나가는 SiglensAI 링크가 있다', async ({
        request,
    }) => {
        const res = await request.get(`${MAIN}/`);
        expect(res.status()).toBe(200);
        const html = await res.text();
        const anchor = html.match(
            new RegExp(`<a[^>]+href="${AI}[^"]*"[^>]*>`)
        )?.[0];
        expect(anchor).toBeDefined();
        expect(anchor).toContain('aria-label="SiglensAI Beta"');
        // The home hero's one-line SiglensAI teaser also points at the ai host.
        expect(html).toMatch(
            new RegExp(
                `<a[^>]+href="${AI}/?"[^>]*>(?:(?!</a>).)*Siglens AI`,
                's'
            )
        );
    });

    test('대화는 저장되고, 다른 탭에서 다시 열어 이어서 묻고, 삭제하면 목록과 URL에서 사라진다', async ({
        page,
        context,
    }) => {
        await page.goto(`${AI}/`);
        await page
            .getByRole('textbox', { name: /메시지 입력/ })
            .fill('이어하기 첫 질문');
        await page.keyboard.press('Enter');
        await expect(
            page.getByRole('button', { name: /다시 생성/ })
        ).toBeVisible();
        await expect(page).toHaveURL(/\/c\/[0-9a-f-]{36}$/);
        const conversationId = new URL(page.url()).pathname.split('/c/')[1]!;

        // A second tab is a fresh client: everything it shows comes from the DB.
        const other = await context.newPage();
        await other.goto(`${AI}/`);
        await other
            .getByRole('navigation', { name: '대화 목록' })
            .locator(`a[href$="/c/${conversationId}"]`)
            .click();
        await expect(other).toHaveURL(new RegExp(`/c/${conversationId}$`));
        await expect(other.getByText(/이어하기 첫 질문/).first()).toBeVisible();
        await other
            .getByRole('textbox', { name: /메시지 입력/ })
            .fill('이어하기 두 번째 질문');
        await other.keyboard.press('Enter');
        await expect(
            other.getByText(/"이어하기 두 번째 질문"에 대한 테스트 답변/)
        ).toBeVisible();
        // Same conversation, not a new one.
        await expect(other).toHaveURL(new RegExp(`/c/${conversationId}$`));
        await other.reload();
        await expect(
            other.getByText(/"이어하기 첫 질문"에 대한 테스트 답변/)
        ).toBeVisible();
        await expect(
            other.getByText(/"이어하기 두 번째 질문"에 대한 테스트 답변/)
        ).toBeVisible();

        const row = other
            .getByRole('navigation', { name: '대화 목록' })
            .locator('li')
            .filter({ has: other.locator(`a[href$="/c/${conversationId}"]`) });
        await row.hover();
        await row.getByRole('button', { name: '삭제' }).click();
        await row.getByRole('button', { name: '삭제' }).click();
        await expect(other).toHaveURL(new RegExp(`^${AI}/(ko/)?$`));
        await expect(
            other.locator(`a[href$="/c/${conversationId}"]`)
        ).toHaveCount(0);
        // Hard-deleted: the old URL is not found even for its own owner.
        await other.goto(`${AI}/c/${conversationId}`);
        await expect(
            other.getByRole('heading', { name: '대화를 찾을 수 없습니다' })
        ).toBeVisible();
        await other.close();
    });

    test('siglens.io 진입 링크의 ?q= 는 입력창에만 채워지고 자동 전송되지 않는다', async ({
        page,
    }) => {
        await page.goto(`${AI}/?q=${encodeURIComponent('NVDA 지금 어때?')}`);
        await expect(
            page.getByRole('textbox', { name: /메시지 입력/ })
        ).toHaveValue('NVDA 지금 어때?');
        await expect(page.getByText(/\[E2E agent\]/)).toHaveCount(0);
        await expect(page).toHaveURL(/\?q=/);
    });
});

test.describe('SiglensAI SEO', () => {
    const GOOGLEBOT =
        'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

    test('크롤러는 핸드오프 없이 랜딩을 받고, 메타·canonical·구조화 데이터가 있다', async ({
        request,
    }) => {
        const res = await request.get(`${AI}/`, {
            headers: { 'user-agent': GOOGLEBOT },
            maxRedirects: 0,
        });
        expect(res.status()).toBe(200);
        expect(res.headers()['x-robots-tag']).toBeUndefined();
        const html = await res.text();
        expect(html).not.toContain('http-equiv="refresh"');
        expect(html).toMatch(/<title>SiglensAI \(Beta\)[^<]+<\/title>/);
        expect(html).toMatch(/<meta name="description" content="[^"]{40,}"/);
        expect(html).toContain('<meta name="robots" content="index, follow"/>');
        expect(html).toMatch(
            new RegExp(`<link rel="canonical" href="${AI}/?"`)
        );
        expect(html).toContain(`${AI}/api/ai/og?locale=ko`);
        expect(html).toContain('"@type":"WebApplication"');
        expect(html).toMatch(/<h1[^>]*>/);
    });

    test('robots.txt 는 대화를 막고 sitemap 은 홈만 싣는다, 대화 URL 은 noindex 헤더', async ({
        request,
    }) => {
        const robots = await (await request.get(`${AI}/robots.txt`)).text();
        expect(robots).toContain('Disallow: /c/');
        expect(robots).toContain(`Sitemap: ${AI}/sitemap.xml`);
        const sitemap = await request.get(`${AI}/sitemap.xml`);
        expect(sitemap.headers()['content-type']).toMatch(/xml/);
        const xml = await sitemap.text();
        expect(xml).toContain(`<loc>${AI}/</loc>`);
        expect(xml).not.toContain('/c/');
        const conv = await request.get(
            `${AI}/c/00000000-0000-4000-8000-000000000000?sso=none`,
            { maxRedirects: 0 }
        );
        expect(conv.headers()['x-robots-tag']).toBe('noindex, nofollow');
        const og = await request.get(`${AI}/api/ai/og?locale=ko`);
        expect(og.status()).toBe(200);
        expect(og.headers()['content-type']).toBe('image/png');
    });
});
