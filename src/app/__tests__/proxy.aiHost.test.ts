import {
    beforeEach,
    describe,
    expect,
    it,
    vi,
    type MockedFunction,
} from 'vitest';

vi.mock('@/shared/config/cookieNames', () => ({
    AUTH_SESSION_COOKIE_NAME: 'siglens_session',
}));
const { mockIntlMiddleware } = vi.hoisted(() => ({
    mockIntlMiddleware: vi.fn(() => ({ type: 'intl' })),
}));
vi.mock('next-intl/middleware', () => ({ default: () => mockIntlMiddleware }));
vi.mock('next/server', () => {
    class FakeResponse {
        headers = new Headers();
        constructor(
            public body: string,
            init?: { headers?: Record<string, string> }
        ) {
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
            })),
        }),
    };
});

import { NextResponse, type NextRequest } from 'next/server';
import { proxy } from '@/proxy';

const mockRedirect = NextResponse.redirect as MockedFunction<
    typeof NextResponse.redirect
>;
const mockRewrite = NextResponse.rewrite as MockedFunction<
    typeof NextResponse.rewrite
>;
const mockNext = NextResponse.next as MockedFunction<typeof NextResponse.next>;

function makeRequest(host: string, path: string): NextRequest {
    return {
        url: `https://${host}${path}`,
        headers: new Headers({ host }),
        cookies: { get: () => undefined },
    } as unknown as NextRequest;
}

describe('proxy — ai host', () => {
    beforeEach(() => vi.clearAllMocks());

    it('루트를 /ai/{locale}로 rewrite하고 CSP를 붙인다 — 랜딩은 색인 대상이라 noindex 헤더 없음', () => {
        const res = proxy(makeRequest('ai.siglens.io', '/')) as unknown as {
            headers: Headers;
        };
        expect(mockRewrite).toHaveBeenCalledTimes(1);
        expect((mockRewrite.mock.calls[0]![0] as URL).pathname).toBe('/ai/ko');
        // 미들웨어 CSP가 next.config의 `frame-ancestors 'none'`을 완전히 대체하므로
        // 두 지시문을 여기서 함께 실어야 한다.
        expect(res.headers.get('content-security-policy')).toBe(
            "frame-ancestors 'none'; img-src 'self' data:"
        );
        expect(res.headers.get('x-robots-tag')).toBeNull();
    });
    it.each(['/c/abc', '/en/c/abc'])(
        '%s — 대화는 사적 기록이라 X-Robots-Tag noindex',
        path => {
            const res = proxy(
                makeRequest('ai.siglens.io', path)
            ) as unknown as {
                headers: Headers;
            };
            expect(res.headers.get('x-robots-tag')).toBe('noindex, nofollow');
        }
    );
    it('로케일 접두 경로 유지', () => {
        proxy(makeRequest('ai.siglens.io', '/en/c/abc'));
        expect(mockRewrite).toHaveBeenCalledTimes(1);
        expect((mockRewrite.mock.calls[0]![0] as URL).pathname).toBe(
            '/ai/en/c/abc'
        );
    });
    it('dev 호스트 ai.localhost:3000', () => {
        proxy(makeRequest('ai.localhost:3000', '/'));
        expect(mockRewrite).toHaveBeenCalledTimes(1);
        expect((mockRewrite.mock.calls[0]![0] as URL).pathname).toBe('/ai/ko');
    });
    it('robots.txt — 랜딩은 열고 대화(/c/)는 막고, sitemap을 가리킨다', () => {
        const res = proxy(
            makeRequest('ai.siglens.io', '/robots.txt')
        ) as unknown as { body: string };
        expect(res.body).toBe(
            'User-agent: *\nAllow: /\nDisallow: /c/\nDisallow: /*/c/\n\nSitemap: https://ai.siglens.io/sitemap.xml\n'
        );
        expect(mockRewrite).not.toHaveBeenCalled();
    });
    it('sitemap.xml — 색인 가능한 로케일의 홈만, 대화 URL 없음', () => {
        const res = proxy(
            makeRequest('ai.siglens.io', '/sitemap.xml')
        ) as unknown as { body: string; headers: Headers };
        expect(res.headers.get('content-type')).toMatch(/application\/xml/);
        expect(res.body).toContain('<loc>https://ai.siglens.io/</loc>');
        expect(res.body).not.toContain('/c/');
        expect(mockRewrite).not.toHaveBeenCalled();
    });
    it('메인 호스트 sitemap.xml은 next() — ai 전용 응답이 새지 않는다', () => {
        proxy(makeRequest('siglens.io', '/sitemap.xml'));
        expect(mockNext).toHaveBeenCalledTimes(1);
        expect(mockIntlMiddleware).not.toHaveBeenCalled();
    });
    it('메인 호스트 robots.txt는 next()', () => {
        proxy(makeRequest('siglens.io', '/robots.txt'));
        expect(mockNext).toHaveBeenCalledTimes(1);
        expect(mockIntlMiddleware).not.toHaveBeenCalled();
    });
    it('메인 호스트 /ai/* → ai 호스트 301', () => {
        proxy(makeRequest('siglens.io', '/ai/ko/c/abc'));
        expect(mockRedirect).toHaveBeenCalledTimes(1);
        const [url, status] = mockRedirect.mock.calls[0]!;
        expect((url as URL).toString()).toBe('https://ai.siglens.io/ko/c/abc');
        expect(status).toBe(301);
    });

    /**
     * `AI`는 실존 티커(C3.ai, popular-tickers·sitemap 등재)다. `/ai` 판정은
     * 정확한 소문자 전체 세그먼트일 때만 걸려야 하고, 대소문자 무시로 판정하면
     * `/AI`·`/AI/news`·`/en/AI`가 전부 SiglensAI 호스트로 오탐 리다이렉트된다
     * (로케일과 철자가 같은 티커를 구제하는 `KO` 판정과 동일한 원칙).
     */
    it.each(['/AI', '/AI/news', '/en/AI'])(
        '%s — 실존 티커라 ai 호스트로 redirect하지 않는다',
        path => {
            proxy(makeRequest('siglens.io', path));
            expect(mockRedirect).not.toHaveBeenCalled();
        }
    );

    it('/Ai — 혼합 케이스 티커는 여전히 /AI로 대문자 정규화된다', () => {
        proxy(makeRequest('siglens.io', '/Ai'));
        expect(mockRedirect).toHaveBeenCalledTimes(1);
        const [url, status] = mockRedirect.mock.calls[0]!;
        expect((url as URL).pathname).toBe('/AI');
        expect(status).toBe(301);
    });

    /** `rest='//evil.com'` → 기본 로케일은 접두사가 없어 외부 호스트가 되던 경로. */
    it('/ai//evil.com — 외부 호스트가 아니라 ai 호스트로 redirect한다', () => {
        proxy(makeRequest('siglens.io', '/ai//evil.com'));
        expect(mockRedirect).toHaveBeenCalledTimes(1);
        const [url] = mockRedirect.mock.calls[0]!;
        expect((url as URL).host).toBe('ai.siglens.io');
        expect((url as URL).toString()).toBe('https://ai.siglens.io/evil.com');
    });

    it('/ai?x=1 — 쿼리스트링을 보존한 채 ai 호스트로 redirect한다', () => {
        proxy(makeRequest('siglens.io', '/ai?x=1'));
        expect(mockRedirect).toHaveBeenCalledTimes(1);
        const [url] = mockRedirect.mock.calls[0]!;
        expect((url as URL).toString()).toBe('https://ai.siglens.io/?x=1');
    });

    it('/en/ai/x — 로케일 접두사를 유지한 채 ai 호스트로 redirect한다', () => {
        proxy(makeRequest('siglens.io', '/en/ai/x'));
        expect(mockRedirect).toHaveBeenCalledTimes(1);
        const [url] = mockRedirect.mock.calls[0]!;
        expect((url as URL).toString()).toBe('https://ai.siglens.io/en/x');
    });

    it('/ko/ai/c/x — 기본 로케일 접두사 제거와 한 홉에 끝난다 (2홉 아님)', () => {
        proxy(makeRequest('siglens.io', '/ko/ai/c/x'));
        expect(mockRedirect).toHaveBeenCalledTimes(1);
        const [url, status] = mockRedirect.mock.calls[0]!;
        expect((url as URL).toString()).toBe('https://ai.siglens.io/c/x');
        expect(status).toBe(301);
    });
});
