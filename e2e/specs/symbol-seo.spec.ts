import { test, expect } from '../support/fixtures';

/**
 * [symbol] ISR + structured-data SEO (crawler-facing) — Tier 4 cross-cutting.
 *
 * The [symbol] routes were migrated to ISR (generateStaticParams=[] +
 * revalidate=3600) with the SEO-critical surface (single h1, inline JSON-LD,
 * robots) kept in the SSR HTML so JS-disabled crawlers (Naver Yeti / Bing /
 * social unfurlers) still see it. These probes assert that crawler-facing
 * contract against the production build, using page.request (raw HTTP, like a
 * crawler) rather than page navigations — sub-resources and client hydration
 * are irrelevant to what a bot indexes.
 *
 * Ground truth captured against `next start` (E2E build, no FMP key):
 *   - /AAPL (seeded)        → 200, robots "index, follow", 1 <h1>, 8 ld+json blocks
 *   - /ZZZZ (unapproved)    → 200 + robots "noindex, nofollow" (degraded fallback,
 *                             NOT 500 — getAssetInfoResilient returns a degraded
 *                             ticker rather than throwing; see PR #549, while
 *                             the indexability gate blocks longtail exposure)
 *   - /AAPL  warmed 2nd req → `x-nextjs-cache: HIT` (ISR cache serves the route)
 */

// `[\s\S]*?` (not the `s`/dotAll flag, which needs an es2018+ target) so the
// matcher is newline-tolerant while staying within this project's TS target.
const LD_JSON_RE = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;

/**
 * Pull every inline JSON-LD block out of SSR HTML and JSON.parse it (which also
 * proves each block is syntactically valid — JsonLd unicode-escapes any `<` in
 * the JSON, which is still legal JSON, so the parse round-trips). Returns the
 * root @type of each block.
 */
function rootJsonLdTypes(html: string): string[] {
    return Array.from(html.matchAll(LD_JSON_RE), match => {
        // JSON.parse returns `any`; the cast just narrows it for the @type read.
        const parsed = JSON.parse(match[1]) as Record<string, unknown>;
        return String(parsed['@type']);
    });
}

function countH1(html: string): number {
    return (html.match(/<h1[\s>]/g) ?? []).length;
}

function normalizeReactSsrText(html: string): string {
    return html.replace(/<!--[\s\S]*?-->/g, '');
}

test.describe('symbol SEO + ISR (crawler-facing)', () => {
    test('/AAPL embeds valid inline JSON-LD without chart FAQ boilerplate', async ({
        page,
    }) => {
        const response = await page.request.get('/AAPL');
        expect(response.status()).toBe(200);

        const types = rootJsonLdTypes(await response.text());
        // Assert the specific page-level @types — each presence check is the
        // falsifiable guard (dropping any one fails). We deliberately do NOT
        // pin the total block count: the page sits alongside the global
        // SiteJsonLd blocks, whose count is out of this page's scope and free
        // to change independently.
        expect(types).toContain('WebPage');
        expect(types).toContain('BreadcrumbList');
        expect(types).not.toContain('FAQPage');
    });

    test('/AAPL/news embeds valid inline JSON-LD (Article + BreadcrumbList)', async ({
        page,
    }) => {
        const response = await page.request.get('/AAPL/news');
        expect(response.status()).toBe(200);

        const types = rootJsonLdTypes(await response.text());
        // Same rationale as the /AAPL test: assert the specific page-level
        // @types (the falsifiable guard), not the global block total.
        expect(types).toContain('Article');
        expect(types).toContain('BreadcrumbList');
    });

    test('/AAPL/news exposes SSR factual summary text before hydration', async ({
        page,
    }) => {
        const response = await page.request.get('/AAPL/news');
        expect(response.status()).toBe(200);

        const html = await response.text();
        const normalizedHtml = normalizeReactSsrText(html);
        expect(html).toContain('최근 뉴스 데이터 요약');
        expect(normalizedHtml).toMatch(
            /최신 뉴스 데이터가 아직 준비되지 않았습니다|AI 뉴스 카드 분석은 \d+건 완료됐습니다/
        );
        expect(normalizedHtml).toMatch(
            /뉴스 카드가 분석되면 최근 기사와 분위기 요약이 이 영역에 표시됩니다|뉴스 흐름과 함께 어닝 일정, 최근 실적, 애널리스트 등급 변경을 이어서 확인할 수 있습니다/
        );
    });

    test('/AAPL/overall exposes SSR factual fallback text before hydration', async ({
        page,
    }) => {
        const response = await page.request.get('/AAPL/overall');
        expect(response.status()).toBe(200);

        const html = await response.text();
        expect(html).toContain('종합 분석 데이터 상태');
        expect(html).toContain('최근 뉴스 데이터는 아직 준비되지 않았습니다.');
    });

    test('/AAPL SSR HTML has exactly one h1 (no cloaking / no duplicate headings)', async ({
        page,
    }) => {
        const html = await (await page.request.get('/AAPL')).text();
        expect(countH1(html)).toBe(1);
    });

    test('/AAPL is served from the ISR cache (x-nextjs-cache HIT on a warmed request)', async ({
        page,
    }) => {
        // Warm the route so this assertion is independent of suite ordering
        // (a cold first-ever request would be MISS; the second is HIT).
        await page.request.get('/AAPL');
        const response = await page.request.get('/AAPL');

        expect(response.status()).toBe(200);
        // `x-nextjs-cache: HIT` is the falsifiable ISR-serving signal. We
        // intentionally do NOT also assert the s-maxage seconds — that would
        // duplicate the production `revalidate` literal here and drift if it
        // changes (the cache-being-hit is the property under test, not its TTL).
        expect(response.headers()['x-nextjs-cache']).toBe('HIT');
    });

    test('/AAPL/financials embeds valid inline JSON-LD (WebPage + BreadcrumbList + FAQPage)', async ({
        page,
    }) => {
        // 런타임 HTML을 크롤러처럼 fetch해 inline JSON-LD 블록을 파싱한다.
        // source-grep 단언(readFileSync + toContain)을 대체한다 — 동작이 아니라
        // 구현 세부를 검사하는 brittleness를 제거한다.
        const response = await page.request.get('/AAPL/financials');
        expect(response.status()).toBe(200);

        const types = rootJsonLdTypes(await response.text());
        expect(types).toContain('WebPage');
        expect(types).toContain('BreadcrumbList');
        expect(types).toContain('FAQPage');
    });

    test('/AAPL/congress embeds valid inline JSON-LD (WebPage + BreadcrumbList + FAQPage)', async ({
        page,
    }) => {
        // 런타임 HTML을 크롤러처럼 fetch해 inline JSON-LD 블록을 파싱한다.
        // source-grep 단언(readFileSync + toContain)을 대체한다.
        const response = await page.request.get('/AAPL/congress');
        expect(response.status()).toBe(200);

        const types = rootJsonLdTypes(await response.text());
        expect(types).toContain('WebPage');
        expect(types).toContain('BreadcrumbList');
        expect(types).toContain('FAQPage');
    });

    test('an unapproved but well-formed ticker degrades to 200 + noindex (never 500)', async ({
        page,
    }) => {
        // ZZZZ is format-valid but intentionally not seeded and not in the
        // approved index footprint. With no FMP key under E2E, getAssetInfo
        // throws an infra error which getAssetInfoResilient catches → degraded
        // fallback. The ISR cold-gen must complete 200 (a thrown
        // DYNAMIC_SERVER_USAGE would 500 — the F2 regression fixed in #549), and
        // generateMetadata must emit noindex for unapproved longtail exposure.
        const response = await page.request.get('/ZZZZ');
        expect(response.status()).toBe(200);

        const html = await response.text();
        expect(html).toMatch(
            /<meta name="robots" content="noindex, nofollow"\/?>/
        );
    });
});
