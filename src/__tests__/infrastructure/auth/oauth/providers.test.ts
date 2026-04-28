import {
    buildOAuthRedirectUri,
    getOAuthAdapter,
    isOAuthProvider,
} from '@/infrastructure/auth/oauth/providers';

describe('isOAuthProvider', () => {
    it('활성화된 provider 문자열은 true를 반환한다', () => {
        expect(isOAuthProvider('google')).toBe(true);
        expect(isOAuthProvider('kakao')).toBe(true);
    });
    it('siglens-core가 알지만 siglens 앱에서 비활성화된 provider는 false', () => {
        expect(isOAuthProvider('apple')).toBe(false);
    });
    it('지원하지 않는 문자열은 false를 반환한다', () => {
        expect(isOAuthProvider('facebook')).toBe(false);
        expect(isOAuthProvider('')).toBe(false);
    });
});

describe('getOAuthAdapter', () => {
    it('각 provider id에 대응하는 어댑터를 반환한다', () => {
        expect(getOAuthAdapter('google').id).toBe('google');
        expect(getOAuthAdapter('kakao').id).toBe('kakao');
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
        expect(buildOAuthRedirectUri('kakao')).toBe(
            'https://siglens.app/api/auth/callback/kakao'
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
