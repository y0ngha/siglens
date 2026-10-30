vi.mock('@/features/auth-oauth/lib/providers', () => ({
    getOAuthRedirectBaseUrl: vi.fn().mockReturnValue('https://siglens.io'),
}));
vi.mock('@/features/auth-oauth/lib/state', () => ({
    expiredOAuthStateCookie: vi
        .fn()
        .mockReturnValue({ name: 'oauth_state', value: '', maxAge: 0 }),
}));

import { describe, it, expect, vi } from 'vitest';
import {
    localeFromNext,
    redirectToLoginWithError,
} from '@/app/api/auth/callback/_lib/loginRedirect';

function locationOf(response: Response): URL {
    return new URL(response.headers.get('location') ?? '');
}

describe('localeFromNext', () => {
    it('next가 없으면 기본 로케일(ko)이다', () => {
        expect(localeFromNext(undefined)).toBe('ko');
    });

    it('next의 로케일 접두사를 복원한다', () => {
        expect(localeFromNext('/en/AAPL')).toBe('en');
    });
});

describe('redirectToLoginWithError', () => {
    it('기본 로케일 로그인으로 error 코드를 실어 보낸다', () => {
        const url = locationOf(redirectToLoginWithError('oauth_unknown'));
        expect(url.origin).toBe('https://siglens.io');
        expect(url.pathname).toBe('/login');
        expect(url.searchParams.get('error')).toBe('oauth_unknown');
    });

    it('next의 로케일로 로그인 경로를 만든다', () => {
        const url = locationOf(
            redirectToLoginWithError('oauth_unknown', undefined, '/ja/AAPL')
        );
        expect(url.pathname).toBe('/ja/login');
    });

    it('email이 있으면 쿼리에 싣고 없으면 싣지 않는다', () => {
        expect(
            locationOf(
                redirectToLoginWithError('oauth_email_conflict', 'a@b.com')
            ).searchParams.get('email')
        ).toBe('a@b.com');
        expect(
            locationOf(
                redirectToLoginWithError('oauth_unknown')
            ).searchParams.has('email')
        ).toBe(false);
    });

    it('기본 경로가 아닌 next는 되실어 주고 기본 경로면 싣지 않는다', () => {
        expect(
            locationOf(
                redirectToLoginWithError('oauth_unknown', undefined, '/AAPL')
            ).searchParams.get('next')
        ).toBe('/AAPL');
        expect(
            locationOf(
                redirectToLoginWithError('oauth_unknown', undefined, '/')
            ).searchParams.has('next')
        ).toBe(false);
    });

    it('오픈 리디렉트로 읽히는 next는 싣지 않는다', () => {
        const url = locationOf(
            redirectToLoginWithError(
                'oauth_unknown',
                undefined,
                '//evil.com/path'
            )
        );
        expect(url.searchParams.has('next')).toBe(false);
        expect(url.origin).toBe('https://siglens.io');
    });

    it('state 쿠키를 만료시킨다', () => {
        const response = redirectToLoginWithError('oauth_unknown');
        expect(response.cookies.get('oauth_state')?.value).toBe('');
    });
});
