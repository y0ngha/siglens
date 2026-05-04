jest.mock('@y0ngha/siglens-core', () => ({
    AUTH_SESSION_COOKIE_NAME: 'siglens_session',
}));
jest.mock('next/server', () => ({
    NextResponse: {
        redirect: jest.fn((url: URL) => ({ type: 'redirect', url })),
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
