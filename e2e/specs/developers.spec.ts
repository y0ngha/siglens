import {
    API_KEY_ENV_NAME,
    PUBLIC_API_RATE_LIMITS,
} from '@/shared/config/publicApi';
import { test, expect } from '../support/fixtures';
import { normalizeReactSsrText } from '../support/ssrText';

/**
 * `/developers` — 공개 API(`/api/v1`) 개발자 포털과 그 문서 파일(`openapi.json`·`openapi.yaml`·`skill`).
 *
 * 로그인도 데이터 저장소도 외부 시세도 필요 없다: 페이지와 문서는 도구 스펙·한도 상수·메시지 카탈로그에서
 * 만들어진다(E2E는 FMP 키가 없는 환경이다). 그래서 SSR HTML 본문을 크롤러가 그대로 받는지,
 * 문서 파일이 실제로 유효한 OpenAPI 구조인지를 여기서 고정한다.
 */
const PATH = '/developers';
const API = '/api/v1';
const GOOGLEBOT_UA =
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
const YETI_UA = 'Mozilla/5.0 (compatible; Yeti/1.1; +http://naver.me/spd)';

interface OpenApiJson {
    openapi: string;
    info: { title: string };
    servers: { url: string }[];
    paths: Record<string, Record<string, { operationId: string }>>;
    components: {
        securitySchemes: Record<string, { type: string; scheme: string }>;
    };
}

test.describe('developers page', () => {
    test('SSR HTML carries the page copy, tool reference, metadata and JSON-LD', async ({
        page,
    }) => {
        const res = await page.request.get(PATH, { maxRedirects: 0 });
        expect(res.status()).toBe(200);
        const html = normalizeReactSsrText(await res.text());

        // 본문 텍스트(골격이 아니다): h1, BYOK 약속, 도구 레퍼런스.
        expect(html).toContain('시그렌즈 API 문서');
        expect(html).toContain('BYOK');
        expect(html).toContain('id="tool-search_ticker"');
        expect(html).toContain('id="tool-run_fresh_analysis"');
        expect(html).toContain('POST /tools/get_quote');
        expect(html).toContain('X-RateLimit-AI-Remaining');
        // 한도는 카탈로그가 아니라 상수에서 온다.
        expect(html).toContain(
            `분당 ${PUBLIC_API_RATE_LIMITS.data.perMinute}회`
        );
        // 서버 비용이 드는 web_search는 문서에 도구로 없다.
        expect(html).not.toContain('id="tool-web_search"');

        // 메타데이터: 제목·설명·canonical·소셜·색인(ko).
        expect(html).toMatch(/<title>시그렌즈 개발자 API: [^<]+<\/title>/);
        expect(html).toMatch(/<meta name="description" content="[^"]{20,}"/);
        expect(html).toMatch(/<link rel="canonical" href="[^"]*\/developers"/);
        expect(html).toMatch(
            /<meta property="og:title" content="시그렌즈 개발자 API/
        );
        expect(html).toMatch(
            /<meta property="og:url" content="[^"]*\/developers"/
        );
        expect(html).toMatch(/<meta name="twitter:card" content="summary"/);
        const robots = /<meta name="robots" content="([^"]*)"/.exec(html)?.[1];
        expect(robots ?? '').not.toContain('noindex');

        expect(html).toContain('"@type":"WebPage"');
        expect(html).toContain('"@type":"BreadcrumbList"');
        expect(html).toContain('"dateModified"');
        expect(html).not.toContain('"@type":"FAQPage"');
    });

    test('crawlers (Googlebot, Naver Yeti) get the same server-rendered body, not a skeleton', async ({
        playwright,
        baseURL,
    }) => {
        for (const userAgent of [GOOGLEBOT_UA, YETI_UA]) {
            const context = await playwright.request.newContext({
                baseURL,
                extraHTTPHeaders: { 'User-Agent': userAgent },
            });
            const res = await context.get(PATH, { maxRedirects: 0 });
            expect(res.status()).toBe(200);
            const html = normalizeReactSsrText(await res.text());
            // h1이 하나이고, 도구 카드의 사람용 요약이 접힌 원문과 함께 SSR에 있다.
            expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
            expect(html).toContain('시그렌즈 API 문서');
            expect(html).toContain('회사 이름이나 심볼 일부로 종목을 찾아요.');
            expect(html).toContain('에이전트용 원문 설명 보기');
            expect(html).toContain('id="tool-get_investor_flows"');
            expect(html).toMatch(
                /<link rel="canonical" href="[^"]*\/developers"/
            );
            expect(html).not.toMatch(/data-technical-facts|hidden id="S:/);
            await context.dispose();
        }
    });

    test('robots.txt lets crawlers read /developers but keeps /api/ (including the OpenAPI files) out', async ({
        request,
    }) => {
        const res = await request.get('/robots.txt');
        expect(res.status()).toBe(200);
        const robots = await res.text();
        expect(robots).toContain('Disallow: /api/');
        expect(robots).not.toMatch(/Disallow: \/developers/);
    });

    test('non-ko locale renders in its language but is not indexed', async ({
        page,
    }) => {
        const res = await page.request.get(`/en${PATH}`, { maxRedirects: 0 });
        expect(res.status()).toBe(200);
        const html = normalizeReactSsrText(await res.text());
        expect(html).toContain('SIGLENS API Documentation');
        expect(html).toMatch(/<meta name="robots" content="noindex/);
        expect(html).toMatch(
            /<link rel="canonical" href="[^"]*\/en\/developers"/
        );
    });

    test('renders the hero, the section nav and the tool reference without login', async ({
        page,
    }) => {
        await page.goto(PATH);

        await expect(page).not.toHaveURL(/\/login/);
        await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
        await expect(
            page.getByRole('heading', { level: 1, name: '시그렌즈 API 문서' })
        ).toBeVisible();
        await expect(
            page.getByRole('link', { name: 'API 키 만들기' })
        ).toHaveAttribute('href', '/account');

        // 데스크톱에서 목차는 따라다닌다(sticky). 좁은 화면 배치는 아래 모바일 테스트가 본다.
        const nav = page.getByRole('navigation', { name: '개발자 문서 목차' });
        await expect(nav).toBeVisible();
        await expect
            .poll(() => nav.evaluate(el => getComputedStyle(el).position))
            .toBe('sticky');
        await nav.getByRole('link', { name: '도구 레퍼런스' }).click();
        await expect(page).toHaveURL(/#tools$/);
        await expect(
            page.getByRole('heading', { level: 3, name: 'search_ticker' })
        ).toBeVisible();
        // 인자 표(inputSchema)와 curl 예시가 도구마다 있다.
        const card = page.getByRole('article', { name: /get_quote/ });
        await expect(card.getByRole('table')).toContainText('symbols');
        await expect(card).toContainText('/api/v1/tools/get_quote');
    });

    test('copy button copies the curl example', async ({ page, context }) => {
        await context.grantPermissions(['clipboard-read', 'clipboard-write']);
        await page.goto(PATH);

        // 복사 버튼은 이름 붙은 코드 영역(`pre`)의 형제라 영역의 부모 블록에서 찾는다.
        const meExample = page
            .getByRole('region', { name: '키 상태 확인 curl 예시' })
            .locator('xpath=..');
        await meExample
            .getByRole('button', { name: '복사: 키 상태 확인 curl 예시' })
            .click();
        await expect(
            meExample.getByRole('button', {
                name: '복사됨: 키 상태 확인 curl 예시',
            })
        ).toBeVisible();
        const copied = await page.evaluate(() =>
            navigator.clipboard.readText()
        );
        expect(copied).toContain('/api/v1/me');
        expect(copied).toContain(`Authorization: Bearer $${API_KEY_ENV_NAME}`);
    });

    test('download buttons point at the three public files', async ({
        page,
    }) => {
        await page.goto(PATH);
        const downloads = page.locator('section', {
            has: page.getByRole('heading', { level: 2, name: '내려받기' }),
        });
        const hrefs = await downloads
            .getByRole('link')
            .evaluateAll(links =>
                links.map(a => [
                    a.getAttribute('href'),
                    a.getAttribute('download'),
                ])
            );
        expect(hrefs).toEqual([
            [`${API}/openapi.json`, 'openapi.json'],
            [`${API}/openapi.yaml`, 'openapi.yaml'],
            [`${API}/skill`, 'SKILL.md'],
        ]);
    });

    test('is linked from the footer and has no horizontal overflow on mobile', async ({
        page,
    }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto('/');
        await expect(
            page
                .getByRole('navigation', { name: '사이트 정보' })
                .getByRole('link', { name: '개발자 API' })
        ).toHaveAttribute('href', '/developers');

        await page.goto(PATH);
        await expect(
            page.getByRole('heading', { level: 1, name: '시그렌즈 API 문서' })
        ).toBeVisible();
        const overflow = await page.evaluate(
            () =>
                document.documentElement.scrollWidth -
                document.documentElement.clientWidth
        );
        expect(overflow).toBeLessThanOrEqual(0);
    });
});

test.describe('public API documents', () => {
    test('openapi.json is a valid OpenAPI 3.1 document with the expected paths', async ({
        request,
    }) => {
        const res = await request.get(`${API}/openapi.json`);
        expect(res.status()).toBe(200);
        expect(res.headers()['content-type']).toContain('application/json');
        expect(res.headers()['cache-control']).toMatch(/^public, /);
        // 문서 파일은 검색 색인에 오르지 않는다 — 사람이 읽는 문서는 /developers다.
        expect(res.headers()['x-robots-tag']).toBe('noindex');

        const doc = (await res.json()) as OpenApiJson;
        expect(doc.openapi).toMatch(/^3\.1\./);
        expect(doc.info.title).toBe('SigLens API');
        expect(doc.servers[0]?.url).toMatch(/\/api\/v1$/);
        expect(doc.components.securitySchemes.bearerAuth).toMatchObject({
            type: 'http',
            scheme: 'bearer',
        });

        const paths = Object.keys(doc.paths);
        for (const expected of [
            '/me',
            '/tools',
            '/tools/search_ticker',
            '/tools/get_quote',
            '/tools/get_bars_indicators',
            '/tools/run_fresh_analysis',
            '/skill',
            '/openapi.json',
            '/openapi.yaml',
        ])
            expect(paths).toContain(expected);
        expect(paths).not.toContain('/tools/web_search');
        // 도구 경로마다 POST 오퍼레이션이고 operationId가 겹치지 않는다.
        const ids = paths.flatMap(path =>
            Object.values(doc.paths[path] ?? {}).map(op => op.operationId)
        );
        expect(new Set(ids).size).toBe(ids.length);
        expect(doc.paths['/tools/get_quote']).toHaveProperty('post');
    });

    test('openapi.yaml serves the same document as YAML', async ({
        request,
    }) => {
        const res = await request.get(`${API}/openapi.yaml`);
        expect(res.status()).toBe(200);
        expect(res.headers()['content-type']).toContain('application/yaml');
        expect(res.headers()['x-robots-tag']).toBe('noindex');
        const yaml = await res.text();
        expect(yaml.startsWith('openapi: "3.1.0"\n')).toBe(true);
        expect(yaml).toContain('"/tools/search_ticker":');
        expect(yaml).not.toContain('"/tools/web_search":');
    });

    test('skill is served without a key and lists the same tools', async ({
        request,
    }) => {
        const res = await request.get(`${API}/skill`);
        expect(res.status()).toBe(200);
        expect(res.headers()['content-type']).toContain('text/markdown');
        expect(res.headers()['x-robots-tag']).toBe('noindex');
        const markdown = await res.text();
        expect(markdown).toContain('### `search_ticker`');
        expect(markdown).not.toContain('### `web_search`');
    });
});
