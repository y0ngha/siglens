import type { SupportedOAuthProvider } from '@/shared/lib/types';
import { googleOAuthAdapter } from './google';
import { e2eFakeOAuthAdapter } from './E2eFakeOAuthAdapter';
import type { OAuthProviderAdapter } from './types';
import { isE2E } from '@/shared/api/e2eEnv';

// NOTE: Kakao login is currently disabled — its adapter is intentionally excluded
// from SUPPORTED_PROVIDERS and ADAPTERS so that /api/auth/kakao/start and the
// callback route reject the provider. Re-enable by adding 'kakao' back here and
// re-introducing kakaoOAuthAdapter.
const SUPPORTED_PROVIDERS: readonly SupportedOAuthProvider[] = ['google'];

const ADAPTERS: Record<SupportedOAuthProvider, OAuthProviderAdapter> = {
    google: googleOAuthAdapter,
};

export function getOAuthAdapter(
    provider: SupportedOAuthProvider
): OAuthProviderAdapter {
    // Under E2E_TEST the fake adapter returns a deterministic fixture profile
    // for any code and contacts no real OAuth provider (see E2eFakeOAuthAdapter).
    // Static-imported (not require-gated) so this branch stays unit-testable —
    // mirrors getLlmProvider's FakeChatProvider rationale.
    if (isE2E()) return e2eFakeOAuthAdapter;
    return ADAPTERS[provider];
}

/** 라우트 파라미터로 들어온 임의 문자열이 활성화된 provider 인지 검증. */
export function isOAuthProvider(
    value: string
): value is SupportedOAuthProvider {
    // SUPPORTED_PROVIDERS is a readonly string-literal list; widening to string[] is only for includes().
    return (SUPPORTED_PROVIDERS as readonly string[]).includes(value);
}

/**
 * OAuth 리다이렉트에 사용할 신뢰된 공개 base URL을 환경변수 단일 소스에서 도출.
 *
 * AWS ALB 뒤에서는 들어온 요청의 `req.url` 호스트가 컨테이너 내부 bind
 * (0.0.0.0:3000)라서 리다이렉트 Location이 깨진다. 그래서 콜백 라우트의 모든
 * 리다이렉트 base와 어댑터 redirect URI는 이 단일 소스를 써야 한다.
 * base 미설정 시 throw (fail-closed). 후행 슬래시는 제거한다.
 */
export function getOAuthRedirectBaseUrl(): string {
    const base =
        process.env.OAUTH_REDIRECT_BASE_URL ?? process.env.NEXT_PUBLIC_SITE_URL;
    if (!base) {
        throw new Error(
            'OAuth redirect base URL is not configured: set OAUTH_REDIRECT_BASE_URL or NEXT_PUBLIC_SITE_URL'
        );
    }
    return base.replace(/\/+$/, '');
}

/** 어댑터가 사용하는 redirect URI를 환경변수 단일 소스에서 도출. base 미설정 시 throw. */
export function buildOAuthRedirectUri(
    provider: SupportedOAuthProvider
): string {
    return `${getOAuthRedirectBaseUrl()}/api/auth/callback/${provider}`;
}
