import type { OAuthProvider } from '@y0ngha/siglens-core';
import { googleOAuthAdapter } from './google';
import { kakaoOAuthAdapter } from './kakao';
import type { OAuthProviderAdapter } from './types';

/** siglens 앱에서 현재 활성화된 OAuth provider. siglens-core 의 OAuthProvider 부분집합. */
export type SupportedOAuthProvider = 'google' | 'kakao';

const SUPPORTED_PROVIDERS: readonly SupportedOAuthProvider[] = [
    'google',
    'kakao',
];

const ADAPTERS: Record<SupportedOAuthProvider, OAuthProviderAdapter> = {
    google: googleOAuthAdapter,
    kakao: kakaoOAuthAdapter,
};

export function getOAuthAdapter(
    provider: SupportedOAuthProvider
): OAuthProviderAdapter {
    return ADAPTERS[provider];
}

/** 라우트 파라미터로 들어온 임의 문자열이 활성화된 provider 인지 검증. */
export function isOAuthProvider(
    value: string
): value is SupportedOAuthProvider {
    return (SUPPORTED_PROVIDERS as readonly string[]).includes(value);
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
