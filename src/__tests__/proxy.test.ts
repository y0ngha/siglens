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
import { proxy } from '../../proxy';

const mockRedirect = NextResponse.redirect as jest.MockedFunction<
    typeof NextResponse.redirect
>;
const mockNext = NextResponse.next as jest.MockedFunction<
    typeof NextResponse.next
>;

function makeRequest(sessionValue: string | undefined): NextRequest {
    return {
        url: 'https://example.com/login',
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

    describe('세션 쿠키가 있을 때', () => {
        it('값이 비어있지 않으면 / 로 redirect한다', () => {
            proxy(makeRequest('valid-token'));
            expect(mockRedirect).toHaveBeenCalledTimes(1);
            const calledUrl = mockRedirect.mock.calls[0]![0] as URL;
            expect(calledUrl.pathname).toBe('/');
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('값이 빈 문자열이면 next()로 통과시킨다', () => {
            proxy(makeRequest(''));
            expect(mockNext).toHaveBeenCalledTimes(1);
            expect(mockRedirect).not.toHaveBeenCalled();
        });
    });

    describe('세션 쿠키가 없을 때', () => {
        it('next()로 통과시킨다', () => {
            proxy(makeRequest(undefined));
            expect(mockNext).toHaveBeenCalledTimes(1);
            expect(mockRedirect).not.toHaveBeenCalled();
        });
    });
});
