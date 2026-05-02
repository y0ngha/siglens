import type { OAuthProvider } from '@/domain/types';
import { googleOAuthRevokerAdapter } from '@/infrastructure/auth/oauth/googleRevoker';
import { kakaoOAuthRevokerAdapter } from '@/infrastructure/auth/oauth/kakaoRevoker';
import type {
    OAuthRevoker,
    OAuthRevokerAdapter,
    RevokeTokenParams,
} from '@/infrastructure/auth/oauth/revokerTypes';

const ADAPTER_MAP: Partial<Record<OAuthProvider, OAuthRevokerAdapter>> = {
    google: googleOAuthRevokerAdapter,
    kakao: kakaoOAuthRevokerAdapter,
};

/** Composite OAuth revoker that delegates to provider-specific adapters; providers without a registered adapter are silently skipped. */
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

export type {
    OAuthRevoker,
    RevokeTokenParams,
} from '@/infrastructure/auth/oauth/revokerTypes';
