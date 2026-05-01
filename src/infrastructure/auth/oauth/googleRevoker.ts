import { constants } from 'node:http2';
import { REVOKE_TIMEOUT_MS } from './revokerConstants';
import type { OAuthRevokerAdapter, RevokeTokenParams } from './revokerTypes';

const { HTTP_STATUS_OK } = constants;

const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';

/**
 * @internal Google OAuth adapter — revokes an access token via the Google token revocation endpoint.
 */
export const googleOAuthRevokerAdapter: OAuthRevokerAdapter = {
    async revokeToken({ accessToken }: RevokeTokenParams): Promise<void> {
        const url = `${REVOKE_URL}?token=${encodeURIComponent(accessToken)}`;
        const response = await fetch(url, {
            method: 'POST',
            signal: AbortSignal.timeout(REVOKE_TIMEOUT_MS),
        });
        if (response.status !== HTTP_STATUS_OK) {
            throw new Error(
                `Google token revocation failed with status ${response.status}`
            );
        }
    },
};
