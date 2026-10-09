import { expect, test } from '../support/fixtures';

/**
 * 차트 가이드(`/guide`) — 크롤러 대면 계약 + 헤더 진입.
 *
 * 가이드는 `db/seeds/guide`를 `e2e/setup/seed.ts`가 그대로 적재한 DB에서 읽는다(외부 키 없음).
 * 봇이 색인하는 것은 하이드레이션 이전의 SSR HTML이라 `page.request`(raw HTTP)에 봇 UA를
 * 실어 본다 — 허브 카드 목록, 항목의 H1·데모 차트·FAQ·JSON-LD가 JS 없이 HTML에 있어야 하고,
 * ko 페이지에는 noindex가 없어야 한다(색인은 ko만, `localePageRobots`).
 */

const GOOGLEBOT_UA =
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

const ENTRY_PATH = '/guide/chart-patterns/double-bottom';
const ENTRY_TITLE = '이중바닥';

const LD_JSON_RE = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;

function jsonLdBlocks(html: string): Record<string, unknown>[] {
    return Array.from(html.matchAll(LD_JSON_RE), match =>
        JSON.parse(match[1]!)
    ) as Record<string, unknown>[];
}

function robotsMeta(html: string): string | null {
    return html.match(/<meta name="robots" content="([^"]*)"/i)?.[1] ?? null;
}

test.describe('guide (crawler-facing)', () => {
    test.use({ userAgent: GOOGLEBOT_UA });

    test('허브가 H1·분류 섹션·항목 카드 링크를 서버에서 그린다', async ({
        page,
    }) => {
        const response = await page.request.get('/guide');
        expect(response.status()).toBe(200);
        const html = await response.text();

        expect((html.match(/<h1[\s>]/g) ?? []).length).toBe(1);
        expect(html).toContain('차트 가이드');
        // 분류별 섹션(h2)이 둘 이상 — 캔들·차트 패턴·보조지표·전략.
        expect((html.match(/<h2[\s>]/g) ?? []).length).toBeGreaterThanOrEqual(
            2
        );
        expect(html).toContain(`href="${ENTRY_PATH}"`);
        expect(robotsMeta(html) ?? '').not.toContain('noindex');
    });

    test('항목 페이지가 H1·데모 차트·FAQ·JSON-LD를 서버에서 그린다', async ({
        page,
    }) => {
        const response = await page.request.get(ENTRY_PATH);
        expect(response.status()).toBe(200);
        const html = await response.text();

        expect((html.match(/<h1[\s>]/g) ?? []).length).toBe(1);
        expect(html).toMatch(new RegExp(`<h1[^>]*>${ENTRY_TITLE}<`));
        expect(html).toContain('<figure');
        expect(html).toContain('자주 묻는 질문');
        expect(jsonLdBlocks(html).length).toBeGreaterThan(0);
        expect(robotsMeta(html) ?? '').not.toContain('noindex');
    });
});

test.describe('guide (browser)', () => {
    test('헤더의 가이드 링크로 허브에 진입한다', async ({ page }) => {
        await page.goto('/');

        await page
            .getByRole('banner')
            .getByRole('navigation', { name: '주요 네비게이션' })
            .getByRole('link', { name: '가이드', exact: true })
            .click();

        await expect(page).toHaveURL(/\/guide$/);
        await expect(
            page.getByRole('heading', { level: 1, name: '차트 가이드' })
        ).toBeVisible();
    });
});
