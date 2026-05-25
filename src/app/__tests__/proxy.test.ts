import type { MockedFunction } from 'vitest';
// proxy.ts는 @/shared/config/cookieNames에서 AUTH_SESSION_COOKIE_NAME을 import한다.
// edge runtime 안전성을 위해 entities barrel 대신 shared 순수 상수 파일 사용.
vi.mock('@/shared/config/cookieNames', () => ({
    AUTH_SESSION_COOKIE_NAME: 'siglens_session',
}));
vi.mock('next/server', () => ({
    NextResponse: {
        redirect: vi.fn((url: URL, status?: number) => ({
            type: 'redirect',
            url,
            status,
        })),
        next: vi.fn(() => ({ type: 'next' })),
    },
}));

import { NextResponse, type NextRequest } from 'next/server';
import { proxy } from '@/proxy';

const mockRedirect = NextResponse.redirect as MockedFunction<
    typeof NextResponse.redirect
>;
const mockNext = NextResponse.next as MockedFunction<typeof NextResponse.next>;

function makeRequest(
    sessionValue: string | undefined,
    path = '/login'
): NextRequest {
    return {
        url: `https://example.com${path}`,
        cookies: {
            get: vi.fn((name: string) =>
                name === 'siglens_session' && sessionValue !== undefined
                    ? { value: sessionValue }
                    : undefined
            ),
        },
    } as unknown as NextRequest;
}

describe('proxy', () => {
    beforeEach(() => {
        mockRedirect.mockClear();
        mockNext.mockClear();
    });

    describe('역방향 가드 — guest-only 경로', () => {
        const guestOnlyPaths = [
            '/login',
            '/signup',
            '/forgot-password',
            '/reset-password',
        ];

        it.each(guestOnlyPaths)(
            '%s — 세션이 있으면 / 로 redirect한다',
            path => {
                proxy(makeRequest('valid-token', path));
                expect(mockRedirect).toHaveBeenCalledTimes(1);
                const calledUrl = mockRedirect.mock.calls[0]![0] as URL;
                expect(calledUrl.pathname).toBe('/');
                expect(mockNext).not.toHaveBeenCalled();
            }
        );

        it.each(guestOnlyPaths)(
            '%s — 세션이 없으면 next()로 통과시킨다',
            path => {
                proxy(makeRequest(undefined, path));
                expect(mockNext).toHaveBeenCalledTimes(1);
                expect(mockRedirect).not.toHaveBeenCalled();
            }
        );

        it('세션 값이 빈 문자열이면 next()로 통과시킨다', () => {
            proxy(makeRequest(''));
            expect(mockNext).toHaveBeenCalledTimes(1);
            expect(mockRedirect).not.toHaveBeenCalled();
        });
    });

    describe('전방 가드 — auth-required 경로', () => {
        const authRequiredPaths = ['/account', '/account/delete'];

        it.each(authRequiredPaths)(
            '%s — 세션이 없으면 /login 으로 redirect한다',
            path => {
                proxy(makeRequest(undefined, path));
                expect(mockRedirect).toHaveBeenCalledTimes(1);
                const calledUrl = mockRedirect.mock.calls[0]![0] as URL;
                expect(calledUrl.pathname).toBe('/login');
                expect(mockNext).not.toHaveBeenCalled();
            }
        );

        it.each(authRequiredPaths)(
            '%s — 세션이 있으면 next()로 통과시킨다',
            path => {
                proxy(makeRequest('valid-token', path));
                expect(mockNext).toHaveBeenCalledTimes(1);
                expect(mockRedirect).not.toHaveBeenCalled();
            }
        );
    });
});

describe('Ticker 케이스 정규화 — 소문자/혼합 케이스 → 대문자 301', () => {
    beforeEach(() => {
        mockRedirect.mockClear();
        mockNext.mockClear();
    });

    it.each([
        ['/aapl', '/AAPL'],
        ['/aapl/fundamental', '/AAPL/fundamental'],
        ['/Aapl/news', '/AAPL/news'],
        ['/tsla/overall', '/TSLA/overall'],
        ['/brk.b/fundamental', '/BRK.B/fundamental'],
        // TICKER_RE 호환 — 하이픈 ticker(PBR-A)와 6+ 글자 ticker도 정규화
        ['/pbr-a', '/PBR-A'],
        ['/abcdef/news', '/ABCDEF/news'],
        // TICKER_RE 최대 길이(8자) 경계
        ['/abcdefgh', '/ABCDEFGH'],
        ['/abcdefgh/options', '/ABCDEFGH/options'],
    ])('%s → 301 → %s', (input, expectedPath) => {
        proxy(makeRequest(undefined, input));
        expect(mockRedirect).toHaveBeenCalledTimes(1);
        const [calledUrl, status] = mockRedirect.mock.calls[0]!;
        expect((calledUrl as URL).pathname).toBe(expectedPath);
        expect(status).toBe(301);
        expect(mockNext).not.toHaveBeenCalled();
    });

    it.each([
        '/AAPL',
        '/AAPL/fundamental',
        '/TSLA/overall',
        '/BRK.B/fundamental',
        '/ABCDEFGH', // 8자 boundary, 이미 대문자
    ])('이미 대문자인 %s 는 redirect하지 않는다', path => {
        proxy(makeRequest(undefined, path));
        expect(mockRedirect).not.toHaveBeenCalled();
        expect(mockNext).toHaveBeenCalledTimes(1);
    });

    // TICKER_RE 형상을 벗어나는 입력은 ticker로 인정되지 않아 정규화 redirect가 발생하지 않는다.
    // (auth-required 가드는 별도로 동작하지만 여기서는 첫 segment가 명명된 페이지가 아니므로
    // ticker 매치만 실패해 fall through → next() 처리.)
    it.each([
        '/abcdefghi', // 9자 — TICKER_RE 최대 길이(8자) 초과
        '/abc12', // 숫자 포함
        '/abc_de', // 언더스코어 — TICKER_RE는 점/하이픈만 허용
    ])('TICKER_RE 형상 위반 %s 는 정규화 redirect하지 않는다', path => {
        proxy(makeRequest(undefined, path));
        expect(mockRedirect).not.toHaveBeenCalled();
        expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it.each([
        '/login',
        '/signup',
        '/market',
        '/backtesting',
        '/terms',
        '/privacy',
        '/account',
    ])(
        'reserved 경로 %s 는 ticker로 오인하지 않는다 (no case redirect)',
        path => {
            proxy(makeRequest(undefined, path));
            if (path === '/account') {
                // auth-required guard: 비로그인 사용자는 /login 으로 redirect
                expect(mockRedirect).toHaveBeenCalledTimes(1);
                const [calledUrl] = mockRedirect.mock.calls[0]!;
                expect((calledUrl as URL).pathname).toBe('/login');
            } else {
                // guest-only 및 public 경로는 세션 없으면 next()로 통과
                expect(mockRedirect).not.toHaveBeenCalled();
            }
        }
    );
});

describe('랜딩 ?q= redirect — proxy가 page.tsx 대신 처리 (ISR 보존)', () => {
    beforeEach(() => {
        mockRedirect.mockClear();
        mockNext.mockClear();
    });

    it.each([
        ['/?q=AAPL', '/AAPL'],
        ['/?q=aapl', '/AAPL'],
        ['/?q=tsla', '/TSLA'],
        ['/?q=BRK.B', '/BRK.B'],
        ['/?q=%20AAPL%20', '/AAPL'], // trim 검증
    ])('%s → %s 로 redirect', (input, expectedPath) => {
        proxy(makeRequest(undefined, input));
        expect(mockRedirect).toHaveBeenCalledTimes(1);
        const [calledUrl] = mockRedirect.mock.calls[0]!;
        expect((calledUrl as URL).pathname).toBe(expectedPath);
        expect(mockNext).not.toHaveBeenCalled();
    });

    it('동일 키 중복 ?q=AAPL&q=TSLA — 첫 번째 값 AAPL로 redirect', () => {
        proxy(makeRequest(undefined, '/?q=AAPL&q=TSLA'));
        expect(mockRedirect).toHaveBeenCalledTimes(1);
        const [calledUrl] = mockRedirect.mock.calls[0]!;
        expect((calledUrl as URL).pathname).toBe('/AAPL');
    });

    it.each(['/?q=invalidticker123', '/?q=', '/?q=TOOLONGTICKER', '/?q=123'])(
        '유효하지 않은 ticker %s 는 fall through (next())',
        input => {
            proxy(makeRequest(undefined, input));
            expect(mockRedirect).not.toHaveBeenCalled();
            expect(mockNext).toHaveBeenCalledTimes(1);
        }
    );

    it('?q=가 없는 / 는 fall through (next())', () => {
        proxy(makeRequest(undefined, '/'));
        expect(mockRedirect).not.toHaveBeenCalled();
        expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('루트가 아닌 /market?q=AAPL 는 redirect하지 않는다', () => {
        proxy(makeRequest(undefined, '/market?q=AAPL'));
        expect(mockRedirect).not.toHaveBeenCalled();
        expect(mockNext).toHaveBeenCalledTimes(1);
    });
});
