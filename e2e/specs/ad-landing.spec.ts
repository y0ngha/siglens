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

    test('each page 404s on the other host', async ({ request }) => {
        const chatOnMain = await request.get(`${MAIN}/lp/stock-chat`, {
            maxRedirects: 0,
        });
        expect(chatOnMain.status()).toBe(404);
        const analysisOnAi = await request.get(`${AI}/lp/stock-analysis`, {
            maxRedirects: 0,
        });
        expect(analysisOnAi.status()).toBe(404);
    });
});
