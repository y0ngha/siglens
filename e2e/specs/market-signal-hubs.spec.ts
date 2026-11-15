import { expect, test } from '../support/fixtures';

/**
 * 신호별 종목 페이지(`/market/signals/*`) — 크롤러 대면 계약.
 *
 * `e2e/setup/seed.ts`가 골든크로스 이력 5행(색인 기준)을 적재하고 데드크로스는 비워 둔다. 봇이 보는 것은
 * 하이드레이션 전 SSR HTML이라 `page.request`(raw HTTP)에 봇 UA를 실어 본다.
 */

const GOOGLEBOT_UA =
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

const LD_JSON_RE = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;

function jsonLdTypes(html: string): string[] {
    return Array.from(html.matchAll(LD_JSON_RE), match => {
        const data = JSON.parse(match[1]!) as Record<string, unknown>;
        return String(data['@type']);
    });
}

function robotsMeta(html: string): string | null {
    return html.match(/<meta name="robots" content="([^"]*)"/i)?.[1] ?? null;
}

test.describe('market signal hubs (crawler-facing)', () => {
    test.use({ userAgent: GOOGLEBOT_UA });

    test('색인 기준을 채운 신호 페이지는 H1·종목 링크·ItemList를 서버에서 그리고 색인 가능하다', async ({
        page,
    }) => {
        const response = await page.request.get('/market/signals/golden-cross');
        expect(response.status()).toBe(200);
        const html = await response.text();

        expect((html.match(/<h1[\s>]/g) ?? []).length).toBe(1);
        expect(html).toContain('골든크로스 종목');
        expect(html).toContain('href="/AAPL"');
        expect(html).toContain('href="/005930.KS"');
        expect(jsonLdTypes(html)).toEqual(
            expect.arrayContaining(['WebPage', 'BreadcrumbList', 'ItemList'])
        );
        expect(robotsMeta(html) ?? '').not.toContain('noindex');
    });

    test('기록이 모자란 신호 페이지는 빈 안내를 그리고 noindex,follow다', async ({
        page,
    }) => {
        const response = await page.request.get('/market/signals/death-cross');
        expect(response.status()).toBe(200);
        const html = await response.text();

        expect(html).toContain('아직 없어요');
        expect(robotsMeta(html) ?? '').toContain('noindex');
        expect(robotsMeta(html) ?? '').toContain('follow');
        expect(jsonLdTypes(html)).not.toContain('ItemList');
    });

    test('목록에 없는 신호는 404다', async ({ page }) => {
        const response = await page.request.get('/market/signals/cci-cross');
        expect(response.status()).toBe(404);
    });

    test('/market 본문에서 신호 페이지로 가는 링크가 서버 렌더된다', async ({
        page,
    }) => {
        const html = await (await page.request.get('/market')).text();

        expect(html).toContain('href="/market/signals/golden-cross"');
        expect(html).toContain('신호별 종목 모아보기');
    });
});
