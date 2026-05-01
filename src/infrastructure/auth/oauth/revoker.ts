import type { OAuthProvider } from '@y0ngha/siglens-core';
import { googleOAuthRevokerAdapter } from './googleRevoker';
import { kakaoOAuthRevokerAdapter } from './kakaoRevoker';
import type {
    OAuthRevoker,
    OAuthRevokerAdapter,
    RevokeTokenParams,
} from './revokerTypes';

const ADAPTER_MAP: Partial<Record<OAuthProvider, OAuthRevokerAdapter>> = {
    google: googleOAuthRevokerAdapter,
    kakao: kakaoOAuthRevokerAdapter,
};

/**
 * Composite OAuth revoker that delegates to provider-specific adapters.
 * Providers without a registered adapter are silently skipped.
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

export type { OAuthRevoker, RevokeTokenParams } from './revokerTypes';
