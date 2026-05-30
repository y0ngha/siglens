import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
    buildOAuthRedirectUri,
    getOAuthAdapter,
    isOAuthProvider,
} from '@/features/auth-oauth/lib/providers';
import { e2eFakeOAuthAdapter } from '@/features/auth-oauth/lib/E2eFakeOAuthAdapter';
import { googleOAuthAdapter } from '@/features/auth-oauth/lib/google';

describe('isOAuthProvider', () => {
    it('활성화된 provider 문자열은 true를 반환한다', () => {
        expect(isOAuthProvider('google')).toBe(true);
    });
    it('siglens-core가 알지만 siglens 앱에서 비활성화된 provider는 false', () => {
        expect(isOAuthProvider('apple')).toBe(false);
        // Kakao login은 현재 비활성화되어 있다. (SUPPORTED_PROVIDERS 참고)
        expect(isOAuthProvider('kakao')).toBe(false);
    });
    it('지원하지 않는 문자열은 false를 반환한다', () => {
        expect(isOAuthProvider('facebook')).toBe(false);
        expect(isOAuthProvider('')).toBe(false);
    });
});

describe('getOAuthAdapter', () => {
    const originalE2E = process.env.E2E_TEST;

    beforeEach(() => {
        delete process.env.E2E_TEST;
    });

    afterEach(() => {
        if (originalE2E === undefined) {
            delete process.env.E2E_TEST;
        } else {
            process.env.E2E_TEST = originalE2E;
        }
    });

    it('각 provider id에 대응하는 어댑터를 반환한다', () => {
        expect(getOAuthAdapter('google').id).toBe('google');
    });

    it('E2E_TEST가 미설정이면 실제 google 어댑터를 반환한다', () => {
        expect(getOAuthAdapter('google')).toBe(googleOAuthAdapter);
    });

    it('E2E_TEST=1이면 fake OAuth 어댑터를 반환한다', () => {
        process.env.E2E_TEST = '1';
        expect(getOAuthAdapter('google')).toBe(e2eFakeOAuthAdapter);
    });

    it('E2E_TEST가 "1"이 아닌 값이면 실제 어댑터를 반환한다', () => {
        process.env.E2E_TEST = '0';
        expect(getOAuthAdapter('google')).toBe(googleOAuthAdapter);
    });
});

describe('buildOAuthRedirectUri', () => {
    const originalRedirect = process.env.OAUTH_REDIRECT_BASE_URL;
    const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

    afterEach(() => {
        process.env.OAUTH_REDIRECT_BASE_URL = originalRedirect;
        process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
    });

    it('OAUTH_REDIRECT_BASE_URL 가 우선순위로 사용된다', () => {
        process.env.OAUTH_REDIRECT_BASE_URL = 'https://app.example.com';
        process.env.NEXT_PUBLIC_SITE_URL = 'https://other.example.com';
        expect(buildOAuthRedirectUri('google')).toBe(
            'https://app.example.com/api/auth/callback/google'
        );
    });

    it('OAUTH_REDIRECT_BASE_URL이 없으면 NEXT_PUBLIC_SITE_URL로 fallback한다', () => {
        delete process.env.OAUTH_REDIRECT_BASE_URL;
        process.env.NEXT_PUBLIC_SITE_URL = 'https://siglens.app';
        expect(buildOAuthRedirectUri('google')).toBe(
            'https://siglens.app/api/auth/callback/google'
        );
    });

    it('베이스 URL 끝의 슬래시는 제거된다', () => {
        process.env.OAUTH_REDIRECT_BASE_URL = 'https://app.example.com/';
        expect(buildOAuthRedirectUri('google')).toBe(
            'https://app.example.com/api/auth/callback/google'
        );
    });

    it('두 변수 모두 비어 있으면 throw한다', () => {
        delete process.env.OAUTH_REDIRECT_BASE_URL;
        delete process.env.NEXT_PUBLIC_SITE_URL;
        expect(() => buildOAuthRedirectUri('google')).toThrow(
            'OAuth redirect base URL is not configured'
        );
    });
});
