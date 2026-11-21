/**
 * provider 어댑터가 구현하고 콜백 라우트가 소비하는 타입. 어댑터는 실패를 throw하지 않고
 * `OAuthProfileResult`로 돌려줘, provider를 추가해도 라우트의 오류 처리가 그대로 유지된다.
 */
import type { OAuthProvider } from '@/shared/lib/types';
import type { SocialLoginUserInput } from '@/entities/auth/lib/authUseCaseTypes';

/** OAuth 콜백 처리 단계의 실패 사유. */
type OAuthProfileFailureReason =
    | 'token_exchange_failed'
    | 'profile_fetch_failed'
    | 'email_missing'
    | 'email_unverified';

/** 토큰 교환 + 프로필 조회 결과. */
export type OAuthProfileResult =
    | { ok: true; profile: SocialLoginUserInput }
    | { ok: false; reason: OAuthProfileFailureReason };

/** provider별 인증 어댑터 인터페이스. */
export interface OAuthProviderAdapter {
    readonly id: OAuthProvider;
    authorizeUrl(params: { state: string; redirectUri: string }): string;
    /**
     * 프로필의 이메일이 provider에서 인증된 것일 때만 `ok: true`를 돌려줘야 한다.
     * `createOAuthUser`가 `emailVerified: true`로 저장하므로 새 provider도 같은 검사를 한다.
     */
    exchangeCodeForProfile(params: {
        code: string;
        redirectUri: string;
    }): Promise<OAuthProfileResult>;
}
