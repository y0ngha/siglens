import type { SupportedOAuthProvider } from '@/shared/lib/types';

/**
 * OAuth 시작 라우트(`app/api/auth/[provider]/start`) 링크. `next`는 그대로 넘긴다.
 * 시작 라우트가 state 쿠키에 서명해 넣기 전에 정제하므로 여기서 클라이언트 검사에
 * 기대지 않는다.
 */
export function buildSocialLoginHref(
    providerId: SupportedOAuthProvider,
    next?: string
): string {
    const base = `/api/auth/${providerId}/start`;
    if (!next) return base;
    return `${base}?${new URLSearchParams({ next }).toString()}`;
}
