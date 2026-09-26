import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/config/cookieNames', () => ({
    AUTH_SESSION_COOKIE_NAME: 'siglens_session',
    GUEST_ID_COOKIE_NAME: 'siglens_guest',
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
        [MAIN, '/lp/stock-chat'],
        [AI, '/lp/stock-analysis'],
        [MAIN, '/lp'],
        [MAIN, '/lp/unknown'],
        [AI, '/lp/unknown'],
        [AI, '/lp/stock-chat/extra'],
    ])('%s%s → 404 with a noindex header', async (host, path) => {
        const res = await run(host, path);
        expect(res.status).toBe(404);
        expect(res.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
        expect(mockIntlMiddleware).not.toHaveBeenCalled();
    });

    it('lp is a reserved segment: /ko/lp/... drops the prefix without uppercasing', async () => {
        const res = await run(MAIN, '/ko/lp/stock-analysis');
        expect(res.type).toBe('redirect');
        expect(res.status).toBe(301);
        expect(res.url?.pathname).toBe('/lp/stock-analysis');
    });

    it('the ai sitemap lists no /lp page', async () => {
        const res = await run(AI, '/sitemap.xml');
        expect(res.body).toContain('<urlset');
        expect(res.body).not.toContain('/lp');
    });
});
