import { lpCopyViolations } from '@/views/lp/__tests__/lpCopyRules';
import { test, expect } from '../support/fixtures';

/**
 * Ad-only landing pages (`src/app/lp/`, spec
 * `docs/superpowers/specs/2026-09-26-ad-landing-pages-design.md`).
 *
 * Google Ads (KR) limits ads whose landing page mentions crypto, so the
 * server HTML must carry no crypto word anywhere: body, header, footer or
 * metadata. Negative assertions run on the HTML with `<script>` removed — the
 * RSC flight payload repeats the rendered text, and what reviewers read is the
 * rendered document.
 */
const MAIN = 'http://localhost:4300';
const AI = 'http://ai.localhost:4300';

const PAGES = [
    { base: MAIN, path: '/lp/stock-analysis', h1: '종목 하나로 AI 종합 분석' },
    { base: AI, path: '/lp/stock-chat', h1: '주식 전용 AI 챗봇' },
] as const;

test.describe('ad landing pages', () => {
    for (const { base, path, h1 } of PAGES) {
        test(`${base}${path} renders 200, noindex, with no crypto wording`, async ({
            request,
        }) => {
            const res = await request.get(`${base}${path}`, {
                maxRedirects: 0,
            });
            expect(res.status()).toBe(200);
            expect(res.headers()['x-robots-tag']).toBe('noindex, nofollow');

            const html = await res.text();
            expect(html).toContain(h1);
            expect(html).toMatch(
                /<meta name="robots" content="noindex, nofollow"/
            );
            expect(html).not.toContain('rel="canonical"');
            expect(html).not.toContain('application/ld+json');
            // The site manifest's name and description mention crypto.
            expect(html).not.toContain('rel="manifest"');

            const body = html.replace(/<script[\s\S]*?<\/script>/g, '');
            expect(lpCopyViolations(body)).toEqual([]);
        });
    }

    test('each page 308-redirects to its own host, keeping the query', async ({
        request,
    }) => {
        const chatOnMain = await request.get(
            `${MAIN}/lp/stock-chat?gclid=abc&utm_source=google`,
            { maxRedirects: 0 }
        );
        expect(chatOnMain.status()).toBe(308);
        expect(chatOnMain.headers()['x-robots-tag']).toBe('noindex, nofollow');
        const chatTarget = new URL(chatOnMain.headers()['location']!);
        expect(chatTarget.pathname).toBe('/lp/stock-chat');
        expect(chatTarget.search).toBe('?gclid=abc&utm_source=google');

        const analysisOnAi = await request.get(
            `${AI}/lp/stock-analysis?gclid=abc`,
            { maxRedirects: 0 }
        );
        expect(analysisOnAi.status()).toBe(308);
        expect(analysisOnAi.headers()['x-robots-tag']).toBe(
            'noindex, nofollow'
        );
        // 목적지(메인)가 서버의 바인딩 오리진(`localhost:4300`)과 같아서 Next가 Location을
        // 상대 경로로 줄여 보낸다(`resolve-routes`의 `getRelativeURL`). 프로덕션에서는 목적지가
        // `siglens.io`고 서버 바인딩이 `localhost:<port>`라 절대 URL이다 — 그 경우는 단위 테스트
        // (`proxy.lp.test.ts`)가 오리진까지 고정한다. 어느 쪽이든 **ai 호스트로 되돌아가는**
        // 값이면 안 되므로 허용 값을 둘로 못 박는다.
        expect([
            `${MAIN}/lp/stock-analysis?gclid=abc`,
            '/lp/stock-analysis?gclid=abc',
        ]).toContain(analysisOnAi.headers()['location']);
    });

    test('an unknown /lp/* path 404s with the root not-found document, still noindex', async ({
        request,
    }) => {
        for (const base of [MAIN, AI]) {
            const res = await request.get(`${base}/lp/zzz`, {
                maxRedirects: 0,
            });
            expect(res.status()).toBe(404);
            expect(res.headers()['x-robots-tag']).toBe('noindex, nofollow');
            // Not the bare `Not Found` text the proxy used to send.
            expect(await res.text()).toContain('<h1');
        }
    });
});
