// proxy.ts는 `@/infrastructure/auth/sessionCookie`에서 AUTH_SESSION_COOKIE_NAME을
// import한다 (siglens-core가 아님). 잘못된 모듈을 mock하면 mock이 실제로 적용되지 않고
// 두 source가 우연히 같은 literal('siglens_session')을 공유한 덕에 통과해온 상태였다.
// sessionCookie.ts는 외부 의존 없는 순수 상수 모듈이라 실제로 mock할 필요도 없지만,
// 명시적으로 의도를 드러내기 위해 올바른 모듈 경로로 mock을 유지한다.
jest.mock('@/infrastructure/auth/sessionCookie', () => ({
    AUTH_SESSION_COOKIE_NAME: 'siglens_session',
}));
jest.mock('next/server', () => ({
    NextResponse: {
        redirect: jest.fn((url: URL, status?: number) => ({
            type: 'redirect',
            url,
            status,
        })),
        next: jest.fn(() => ({ type: 'next' })),
    },
}));

import { NextResponse, type NextRequest } from 'next/server';
import { proxy } from '../proxy';

const mockRedirect = NextResponse.redirect as jest.MockedFunction<
    typeof NextResponse.redirect
>;
const mockNext = NextResponse.next as jest.MockedFunction<
    typeof NextResponse.next
>;

function makeRequest(
    sessionValue: string | undefined,
    path = '/login'
): NextRequest {
    return {
        url: `https://example.com${path}`,
        cookies: {
            get: jest.fn((name: string) =>
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
        // VALID_TICKER_RE 호환 — 하이픈 ticker(PBR-A)와 6+ 글자 ticker도 정규화
        ['/pbr-a', '/PBR-A'],
        ['/abcdef/news', '/ABCDEF/news'],
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
    ])('이미 대문자인 %s 는 redirect하지 않는다', path => {
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
