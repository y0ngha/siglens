import type { OAuthProvider } from '@/shared/lib/types';
import { googleOAuthRevokerAdapter } from './googleRevoker';
import type {
    OAuthRevoker,
    OAuthRevokerAdapter,
    RevokeTokenParams,
} from '../lib/revokerTypes';

const ADAPTER_MAP: Partial<Record<OAuthProvider, OAuthRevokerAdapter>> = {
    google: googleOAuthRevokerAdapter,
};

/**
 * provider별 어댑터로 위임하는 revoker. 어댑터가 없는 provider(kakao·apple)는
 * 조용히 건너뛴다 — 탈퇴 흐름이 미지원 provider 때문에 막히지 않게 한다.
 * 소비자: account-delete 액션.
 */
export const compositeOAuthRevoker: OAuthRevoker = {
    async revokeToken(
        provider: OAuthProvider,
        params: RevokeTokenParams
    ): Promise<void> {
        const adapter = ADAPTER_MAP[provider];
        if (adapter === undefined) {
            return;
        }
        await adapter.revokeToken(params);
    },
};
