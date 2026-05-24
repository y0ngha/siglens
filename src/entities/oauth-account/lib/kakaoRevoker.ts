// NOTE: Kakao login is currently disabled — see SUPPORTED_PROVIDERS in providers.ts.
import { constants } from 'node:http2';
import { REVOKE_TIMEOUT_MS } from './revokerConstants';
import type { OAuthRevokerAdapter, RevokeTokenParams } from './revokerTypes';

const { HTTP_STATUS_OK } = constants;

const UNLINK_URL = 'https://kapi.kakao.com/v1/user/unlink';

/** @internal Kakao OAuth adapter — unlinks the user from the Kakao app using the access token. */
export const kakaoOAuthRevokerAdapter: OAuthRevokerAdapter = {
    async revokeToken({ accessToken }: RevokeTokenParams): Promise<void> {
        const response = await fetch(UNLINK_URL, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
            signal: AbortSignal.timeout(REVOKE_TIMEOUT_MS),
        });
        if (response.status !== HTTP_STATUS_OK) {
            throw new Error(
                `Kakao token revocation failed with status ${response.status}`
            );
        }
    },
};
