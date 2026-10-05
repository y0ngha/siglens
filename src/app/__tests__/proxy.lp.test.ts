import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/config/cookieNames', () => ({
    AUTH_SESSION_COOKIE_NAME: 'siglens_session',
    GUEST_ID_COOKIE_NAME: 'siglens_guest',
    AI_SSO_PROBED_COOKIE_NAME: 'siglens_ai_sso_probed',
    AI_SSO_PROBED_MAX_AGE_SECONDS: 1800,
}));
const { mockIntlMiddleware } = vi.hoisted(() => ({
    mockIntlMiddleware: vi.fn(() => ({ type: 'intl' })),
}));
vi.mock('next-intl/middleware', () => ({ default: () => mockIntlMiddleware }));
vi.mock('next/server', () => {
    class FakeResponse {
        type = 'response';
        headers = new Headers();
        status: number;
        constructor(
            public body: string | null,
            init?: { status?: number; headers?: Record<string, string> }
        ) {
            this.status = init?.status ?? 200;
            for (const [k, v] of Object.entries(init?.headers ?? {}))
                this.headers.set(k, v);
        }
    }
    return {
        NextResponse: Object.assign(FakeResponse, {
            redirect: vi.fn((url: URL, status?: number) => ({
                type: 'redirect',
                url,
                status,
                headers: new Headers(),
            })),
            next: vi.fn(() => ({ type: 'next', headers: new Headers() })),
            rewrite: vi.fn((url: URL) => ({
                type: 'rewrite',
                url,
                headers: new Headers(),
                cookies: { set: vi.fn() },
            })),
        }),
    };
});

import type { NextRequest } from 'next/server';
import { proxy } from '@/proxy';
import { AI_SITE_URL, MAIN_SITE_URL } from '@/shared/config/aiHost';

interface Res {
    type: string;
    status?: number;
    url?: URL;
    body?: string;
    headers: Headers;
}

const MAIN = 'siglens.io';
const AI = 'ai.siglens.io';

function request(host: string, path: string): NextRequest {
    return {
        url: `https://${host}${path}`,
        headers: new Headers({ host }),
        cookies: { get: () => undefined },
    } as unknown as NextRequest;
}

async function run(host: string, path: string): Promise<Res> {
    return (await proxy(request(host, path))) as unknown as Res;
}

describe('proxy — ad landing pages (/lp/*)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('main host passes /lp/stock-analysis through with a noindex header', async () => {
        const res = await run(MAIN, '/lp/stock-analysis');
        expect(res.type).toBe('next');
        expect(res.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
        expect(mockIntlMiddleware).not.toHaveBeenCalled();
    });

    it('ai host rewrites /lp/stock-chat to itself, not into /ai/<locale>', async () => {
        const res = await run(AI, '/lp/stock-chat');
        expect(res.type).toBe('rewrite');
        expect(res.url?.pathname).toBe('/lp/stock-chat');
        expect(res.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
    });

    it.each([
        [MAIN, '/lp/stock-chat', new URL(AI_SITE_URL).origin],
        [AI, '/lp/stock-analysis', new URL(MAIN_SITE_URL).origin],
    ])(
        '%s%s → 308 to the other host, keeping path and query',
        async (host, path, origin) => {
            const res = await run(host, `${path}?gclid=abc&utm_source=google`);
            expect(res.type).toBe('redirect');
            expect(res.status).toBe(308);
            expect(res.url?.origin).toBe(origin);
            expect(res.url?.pathname).toBe(path);
            expect(res.url?.search).toBe('?gclid=abc&utm_source=google');
            expect(res.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
            expect(mockIntlMiddleware).not.toHaveBeenCalled();
        }
    );

    it.each([
        [MAIN, '/lp'],
        [MAIN, '/lp/unknown'],
        [AI, '/lp/unknown'],
        [AI, '/lp/stock-chat/extra'],
    ])(
        '%s%s → rewritten to a path no route matches, so the root not-found renders a 404',
        async (host, path) => {
            const res = await run(host, path);
            expect(res.type).toBe('rewrite');
            expect(res.url?.pathname).toBe('/__lp_not_found__/x/y/z');
            expect(res.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
            expect(mockIntlMiddleware).not.toHaveBeenCalled();
        }
    );

    it('lp is a reserved segment: /ko/lp/... drops the prefix without uppercasing', async () => {
        const res = await run(MAIN, '/ko/lp/stock-analysis');
        expect(res.type).toBe('redirect');
        expect(res.status).toBe(301);
        expect(res.url?.pathname).toBe('/lp/stock-analysis');
    });

    it.each([
        [MAIN, '/en/lp/stock-analysis', '/lp/stock-analysis'],
        [MAIN, '/ja/lp/stock-chat', '/lp/stock-chat'],
        [AI, '/en/lp/stock-analysis', '/lp/stock-analysis'],
        [AI, '/ja/lp/stock-chat', '/lp/stock-chat'],
        [AI, '/ko/lp/stock-chat', '/lp/stock-chat'],
        [MAIN, '/en/lp/zzz', '/lp/zzz'],
        [AI, '/zh/lp', '/lp'],
    ])(
        '%s%s → 301 to %s, never into a locale route',
        async (host, path, target) => {
            const res = await run(host, `${path}?gclid=x`);
            expect(res.type).toBe('redirect');
            expect(res.status).toBe(301);
            expect(res.url?.pathname).toBe(target);
            expect(res.url?.search).toBe('?gclid=x');
            expect(res.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
            expect(mockIntlMiddleware).not.toHaveBeenCalled();
        }
    );

    it('the ai sitemap lists no /lp page', async () => {
        const res = await run(AI, '/sitemap.xml');
        expect(res.body).toContain('<urlset');
        expect(res.body).not.toContain('/lp');
    });
});

/**
 * 두 호스트 설정(`NEXT_PUBLIC_SITE_URL`·`NEXT_PUBLIC_AI_SITE_URL`)이 같은 오리진을 가리키는
 * 환경(로컬 개발에서 ai 호스트를 따로 안 띄운 경우)에서 308은 자기 자신으로 돌아와 무한
 * 루프가 된다. 그땐 리다이렉트를 포기하고 404로 끝나야 한다.
 */
describe('proxy — ad landing redirect loop guard', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.resetModules();
    });

    /**
     * `next start`는 `req.url`을 Host 헤더가 아니라 서버 바인딩 주소(`localhost:<port>`)로
     * 만든다 — 로컬·e2e에서는 Host가 `ai.localhost:4300`이어도 `req.url`은 `localhost:4300`이다.
     * 루프 가드가 `req.url`의 호스트를 쓰면 메인 오리진과 우연히 같아져 308이 404로 바뀐다.
     */
    it('req.url의 호스트가 Host 헤더와 달라도(next start) Host 헤더 기준으로 308을 낸다', async () => {
        vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'http://localhost:4300');
        vi.stubEnv('NEXT_PUBLIC_AI_SITE_URL', 'http://ai.localhost:4300');
        vi.resetModules();
        const { proxy: freshProxy } = await import('@/proxy');
        const req = {
            url: 'http://localhost:4300/lp/stock-analysis?gclid=abc',
            headers: new Headers({ host: 'ai.localhost:4300' }),
            cookies: { get: () => undefined },
        } as unknown as NextRequest;

        const res = (await freshProxy(req)) as unknown as Res;

        expect(res.type).toBe('redirect');
        expect(res.status).toBe(308);
        expect(res.url?.origin).toBe('http://localhost:4300');
        expect(res.url?.search).toBe('?gclid=abc');
    });

    it('목적지 오리진이 요청 호스트와 같으면 308 대신 404 rewrite다', async () => {
        vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://siglens.io');
        vi.stubEnv('NEXT_PUBLIC_AI_SITE_URL', 'https://siglens.io');
        vi.resetModules();
        const { proxy: freshProxy } = await import('@/proxy');

        const res = (await freshProxy(
            request(MAIN, '/lp/stock-chat?gclid=x')
        )) as unknown as Res;

        expect(res.type).toBe('rewrite');
        expect(res.url?.pathname).toBe('/__lp_not_found__/x/y/z');
        expect(res.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
    });

    /** `target.host`는 URL이 소문자로 정규화한다 — 대문자 Host도 같은 호스트로 봐야 루프 가드가 선다. */
    it('Host 헤더가 대문자여도 같은 오리진이면 404 rewrite다', async () => {
        vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://siglens.io');
        vi.stubEnv('NEXT_PUBLIC_AI_SITE_URL', 'https://siglens.io');
        vi.resetModules();
        const { proxy: freshProxy } = await import('@/proxy');
        const req = {
            url: 'https://siglens.io/lp/stock-chat?gclid=x',
            headers: new Headers({ host: 'SIGLENS.IO' }),
            cookies: { get: () => undefined },
        } as unknown as NextRequest;

        const res = (await freshProxy(req)) as unknown as Res;

        expect(res.type).toBe('rewrite');
        expect(res.url?.pathname).toBe('/__lp_not_found__/x/y/z');
    });
});
