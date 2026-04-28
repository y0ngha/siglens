import type { OAuthProvider, SocialLoginUserInput } from '@y0ngha/siglens-core';

/** OAuth 콜백 처리 단계의 실패 사유. */
export type OAuthProfileFailureReason =
    | 'token_exchange_failed'
    | 'profile_fetch_failed'
    | 'email_missing';

/** 토큰 교환 + 프로필 조회 결과. */
export type OAuthProfileResult =
    | { ok: true; profile: SocialLoginUserInput }
    | { ok: false; reason: OAuthProfileFailureReason };

/** provider별 인증 어댑터 인터페이스. */
export interface OAuthProviderAdapter {
    readonly id: OAuthProvider;
    authorizeUrl(params: { state: string; redirectUri: string }): string;
    exchangeCodeForProfile(params: {
        code: string;
        redirectUri: string;
    }): Promise<OAuthProfileResult>;
}
