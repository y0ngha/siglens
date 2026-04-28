import type { OAuthProvider } from '@y0ngha/siglens-core';
import { OAUTH_PROVIDER_VALUES } from '@y0ngha/siglens-core';
import { appleOAuthAdapter } from './apple';
import { googleOAuthAdapter } from './google';
import { kakaoOAuthAdapter } from './kakao';
import type { OAuthProviderAdapter } from './types';

const ADAPTERS: Record<OAuthProvider, OAuthProviderAdapter> = {
    google: googleOAuthAdapter,
    kakao: kakaoOAuthAdapter,
    apple: appleOAuthAdapter,
};

export function getOAuthAdapter(provider: OAuthProvider): OAuthProviderAdapter {
    return ADAPTERS[provider];
}

/** 라우트 파라미터로 들어온 임의 문자열이 지원 provider 인지 검증. */
export function isOAuthProvider(value: string): value is OAuthProvider {
    return (OAUTH_PROVIDER_VALUES as readonly string[]).includes(value);
}

/** 어댑터가 사용하는 redirect URI를 환경변수 단일 소스에서 도출.
 *  OAuth provider는 절대 URL을 요구하므로 base 미설정 시 throw해서 빠르게 실패시킨다. */
export function buildOAuthRedirectUri(provider: OAuthProvider): string {
    const base =
        process.env.OAUTH_REDIRECT_BASE_URL ?? process.env.NEXT_PUBLIC_SITE_URL;
    if (!base) {
        throw new Error(
            'OAuth redirect base URL is not configured: set OAUTH_REDIRECT_BASE_URL or NEXT_PUBLIC_SITE_URL'
        );
    }
    const trimmed = base.endsWith('/') ? base.slice(0, -1) : base;
    return `${trimmed}/api/auth/callback/${provider}`;
}
