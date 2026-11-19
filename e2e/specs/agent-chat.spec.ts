import path from 'node:path';
import type { Locator } from '@playwright/test';
import { test, expect } from '../support/fixtures';
import { AUTH_STORAGE_STATE } from '../support/authUser';

const AI = 'http://ai.localhost:4300';
const MAIN = 'http://localhost:4300';
// e2e 스펙은 CommonJS로 실행된다 — `import.meta`를 쓰면 Playwright가 파일을 읽지도 못하고 모든 샤드가 실패한다.
const CHART_CAPTURE_PNG = path.join(__dirname, '../fixtures/chart-capture.png');

/** 이미지가 실제로 불러와졌는지 — 깨진 이미지는 `naturalWidth`가 0이다. */
const loadedWidth = (img: Locator): Promise<number> =>
    img.evaluate(el => (el instanceof HTMLImageElement ? el.naturalWidth : 0));

test.describe('SIGLENS AI agent chat', () => {
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
        // bespoke `AiHeader`) — its `SIGLENS AI` wordmark shows `aria-current`
        // when `useHrefBase() !== ''`, and the language/theme settings ride
        // along with the rest of the shared chrome — for a member they live in
        // the avatar menu.
        const banner = page.getByRole('banner');
        await expect(
            banner.getByRole('link', { name: 'SIGLENS AI Beta' })
        ).toHaveAttribute('aria-current', 'page');
        await banner.getByRole('button', { name: /사용자 메뉴/ }).click();
        await banner.getByRole('button', { name: /^테마/ }).click();
        await expect(
            banner.getByRole('radiogroup', { name: /^테마/ })
        ).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(
            page.getByRole('heading', { level: 1, name: /시그렌즈 AI/ })
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
            // Named by company once the label lookup lands; the href is the contract.
            page.getByRole('link', { name: /^시그렌즈에서 .+ 보기/ })
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

    test('봉 지표를 읽은 답변에 차트가 붙고, 새로고침해도 같은 차트가 남는다', async ({
        page,
    }) => {
        await page.goto(`${AI}/`);
        await expect(page).toHaveURL(new RegExp(`^${AI}/(ko/)?$`));
        await page
            .getByRole('textbox', { name: /메시지 입력/ })
            .fill('AAPL 차트 보여줘');
        await page.keyboard.press('Enter');
        await expect(page.getByText(/\[E2E agent\]/)).toBeVisible();
        const chart = page.getByTestId('chat-chart');
        await expect(chart).toBeVisible();
        // 높이를 고정해 답변이 흐르는 동안 레이아웃이 흔들리지 않는다.
        const box = await chart.boundingBox();
        expect(box?.height ?? 0).toBeGreaterThan(200);
        await expect(chart.locator('canvas').first()).toBeVisible();
        await expect(
            page.getByRole('button', { name: /다시 생성/ })
        ).toBeVisible();
        await expect(page).toHaveURL(/\/c\/[0-9a-f-]{36}$/);
        await page.reload();
        await expect(page.getByTestId('chat-chart')).toBeVisible();
        await expect(
            page.getByTestId('chat-chart').locator('canvas').first()
        ).toBeVisible();
    });

    test('종목 비교를 물으면 답변에 비교 차트(시각화 블록)가 붙고, 새로고침해도 남는다', async ({
        page,
    }) => {
        await page.goto(`${AI}/`);
        await expect(page).toHaveURL(new RegExp(`^${AI}/(ko/)?$`));
        await page
            .getByRole('textbox', { name: /메시지 입력/ })
            .fill('애플이랑 마이크로소프트 비교 차트 그려줘');
        await page.keyboard.press('Enter');
        await expect(page.getByText(/\[E2E agent\]/)).toBeVisible();
        const block = page.getByTestId('chat-visual-block');
        await expect(block).toBeVisible();
        // 블록 안에는 그림 역할 요소가 여럿이다(틀·차트 캔버스) — 요약 이름으로 집는다.
        await expect(
            block.getByRole('img', { name: /AAPL, MSFT 수익률 비교 선 차트/ })
        ).toBeVisible();
        await expect(block.locator('canvas').first()).toBeVisible();
        // 접힌 데이터 표는 정확한 값을 준다.
        await block.getByText('데이터 표 보기').click();
        await expect(block.getByRole('cell', { name: 'AAPL' })).toBeVisible();
        await expect(page).toHaveURL(/\/c\/[0-9a-f-]{36}$/);
        await page.reload();
        await expect(page.getByTestId('chat-visual-block')).toBeVisible();
        await expect(
            page.getByTestId('chat-visual-block').locator('canvas').first()
        ).toBeVisible();
    });

    test('이미지를 첨부해 보내면 말풍선에 썸네일이 뜨고 답이 오며, 새로고침해도 이미지가 남는다', async ({
        page,
    }) => {
        await page.goto(`${AI}/`);
        await expect(page).toHaveURL(new RegExp(`^${AI}/(ko/)?$`));
        // 첨부가 없을 때는 개인정보 안내가 보이지 않는다.
        await expect(page.getByText(/개인정보가 보이지 않게/)).toHaveCount(0);
        // 숨은 파일 입력에 직접 넣는다 — 선택창은 브라우저 UI라 자동화하지 않는다.
        await page
            .locator('input[type="file"]')
            .setInputFiles(CHART_CAPTURE_PNG);
        const preview = page.getByRole('img', { name: '첨부 이미지 1' });
        await expect(preview).toBeVisible();
        // 보이기만 하고 실제로는 못 불러온(CSP가 `blob:`을 막은) 깨진 이미지를 거른다.
        await expect.poll(() => loadedWidth(preview)).toBeGreaterThan(0);
        await expect(
            page.getByText(
                '계좌번호 등 개인정보가 보이지 않게 가려서 올려 주세요'
            )
        ).toBeVisible();
        // 글 없이 이미지만으로도 보낼 수 있다.
        await page.getByRole('button', { name: '전송' }).click();
        const bubble = page.locator('article[data-role="user"]');
        const live = bubble.getByRole('img', { name: '첨부 이미지 1' });
        await expect(live).toBeVisible();
        await expect.poll(() => loadedWidth(live)).toBeGreaterThan(0);
        await expect(page.getByText(/이미지 1장을 확인했습니다/)).toBeVisible();
        await expect(
            page.getByRole('button', { name: /다시 생성/ })
        ).toBeVisible();
        await expect(page).toHaveURL(/\/c\/[0-9a-f-]{36}$/);
        // 다시 열면 object URL이 아니라 저장된 이미지(조회 라우트)로 보인다.
        await page.reload();
        const stored = page
            .locator('article[data-role="user"]')
            .getByRole('img', { name: '첨부 이미지 1' });
        await expect(stored).toHaveAttribute(
            'src',
            /\/api\/ai\/chat\/images\//
        );
        await expect.poll(() => loadedWidth(stored)).toBeGreaterThan(0);
    });

    test('비로그인: 로그인 없이 묻고 답을 받되 저장되지 않고, 저장된 대화를 가리키면 401', async ({
        browser,
    }) => {
        const context = await browser.newContext({
            storageState: { cookies: [], origins: [] },
        });
        const page = await context.newPage();
        await page.goto(`${AI}/`);
        await expect(page).toHaveURL(/sso=none/);
        await expect(
            page.getByRole('link', { name: /시그렌즈 계정으로 로그인/ }).first()
        ).toHaveAttribute('href', /localhost:4300\/(ko\/)?login\?next=/);
        await page
            .getByRole('textbox', { name: /메시지 입력/ })
            .fill('AAPL 지금 얼마야');
        await page.keyboard.press('Enter');
        await expect(page.getByText(/\[E2E agent\]/)).toBeVisible();
        await expect(
            page.getByRole('button', { name: /다시 생성/ })
        ).toBeVisible();
        // Nothing is stored for a guest: no conversation URL, and the notice says so.
        await expect(page).not.toHaveURL(/\/c\//);
        await expect(
            page.getByText('비회원 대화는 저장되지 않아요.')
        ).toBeVisible();
        const res = await context.request.post(`${AI}/api/ai/chat/stream`, {
            headers: { Origin: AI },
            data: { conversationId: 'c1', message: 'x' },
        });
        expect(res.status()).toBe(401);
        await context.close();
    });

    // `/ai/ko`는 내부 라우트 모양이다. 기본 로케일은 ai 호스트에서도 접두사 없는 URL이
    // 정본이고(`/ko/*`는 301로 뗀다), 메인 호스트 프록시가 한 홉에 그 정본으로 보낸다.
    test('메인 호스트 /ai 는 ai 호스트로 301 (기본 로케일은 접두사 없이 한 홉)', async ({
        request,
    }) => {
        const res = await request.get(`${MAIN}/ai/ko`, { maxRedirects: 0 });
        expect(res.status()).toBe(301);
        expect(res.headers().location).toBe(`${AI}/`);
    });

    // Task S3: the shared `Header`'s `AiNavLink` is a plain cross-origin `<a>`
    // (not a `LocaleLink`) pointing at the ai host — a plain HTML fetch of the
    // main host is enough to prove it is wired, no `ai.localhost` DNS needed.
    // The logo lockup shows only "AI"; the product name is its accessible name.
    test('메인 호스트 헤더에 ai 호스트로 나가는 SIGLENS AI 링크가 있다', async ({
        request,
    }) => {
        const res = await request.get(`${MAIN}/`);
        expect(res.status()).toBe(200);
        const html = await res.text();
        const anchor = html.match(
            new RegExp(`<a[^>]+href="${AI}[^"]*"[^>]*>`)
        )?.[0];
        expect(anchor).toBeDefined();
        expect(anchor).toContain('aria-label="SIGLENS AI Beta"');
        // The home hero's one-line AI teaser (ko `시그렌즈 AI`) also points at the ai host.
        expect(html).toMatch(
            new RegExp(
                `<a[^>]+href="${AI}/?"[^>]*>(?:(?!</a>).)*시그렌즈 AI`,
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

test.describe('SIGLENS AI SEO', () => {
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
        expect(html).toMatch(
            /<title>주식, 코인 AI 챗봇[^<]+\| 시그렌즈 AI<\/title>/
        );
        expect(html).toMatch(/<meta name="description" content="[^"]{40,}"/);
        expect(html).toContain('<meta name="robots" content="index, follow"/>');
        expect(html).toMatch(
            new RegExp(`<link rel="canonical" href="${AI}/?"`)
        );
        // 정적·엣지 캐시되는 경로 형태(`/api/ai/og/<locale>.png`).
        expect(html).toContain(`${AI}/api/ai/og/ko.png`);
        expect(html).toContain('"@type":"WebApplication"');
        expect(html).toMatch(/<h1[^>]*>/);
    });

    test('/about 은 크롤러에게 색인 가능한 소개 페이지를 준다: canonical·FAQPage·전 섹션 텍스트', async ({
        request,
    }) => {
        const res = await request.get(`${AI}/about`, {
            headers: { 'user-agent': GOOGLEBOT },
            maxRedirects: 0,
        });
        expect(res.status()).toBe(200);
        const html = await res.text();
        expect(html).toContain('<meta name="robots" content="index, follow"/>');
        expect(html).toMatch(
            new RegExp(`<link rel="canonical" href="${AI}/about"`)
        );
        expect(html).toContain('"@type":"FAQPage"');
        expect(html).toMatch(/<h1[^>]*>/);
        // The example conversation is in the server HTML, not only after JS runs.
        expect(html).toContain('삼성전자 요즘 흐름 어때?');
        expect(html).toContain('답할 때 이런 데이터를 분석해요');
    });

    test('robots.txt 는 대화를 막고 sitemap 은 홈과 /about 만 싣는다, 대화 URL 은 noindex 헤더', async ({
        request,
    }) => {
        const robots = await (await request.get(`${AI}/robots.txt`)).text();
        expect(robots).toContain('Disallow: /c/');
        expect(robots).toContain(`Sitemap: ${AI}/sitemap.xml`);
        const sitemap = await request.get(`${AI}/sitemap.xml`);
        expect(sitemap.headers()['content-type']).toMatch(/xml/);
        const xml = await sitemap.text();
        expect(xml).toContain(`<loc>${AI}/</loc>`);
        expect(xml).toContain(`<loc>${AI}/about</loc>`);
        expect(xml).not.toContain('/c/');
        const conv = await request.get(
            `${AI}/c/00000000-0000-4000-8000-000000000000?sso=none`,
            { maxRedirects: 0 }
        );
        expect(conv.headers()['x-robots-tag']).toBe('noindex, nofollow');
        // 메타데이터가 가리키는 정적 경로.
        const og = await request.get(`${AI}/api/ai/og/ko.png`);
        expect(og.status()).toBe(200);
        expect(og.headers()['content-type']).toBe('image/png');
        // 이미 공유된 카드가 들고 있는 예전 쿼리스트링 경로도 계속 열려 있다.
        const legacyOg = await request.get(`${AI}/api/ai/og?locale=ko`);
        expect(legacyOg.status()).toBe(200);
        expect(legacyOg.headers()['content-type']).toBe('image/png');
    });
});
