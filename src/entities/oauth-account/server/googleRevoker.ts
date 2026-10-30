import { constants } from 'node:http2';
import type {
    OAuthRevokerAdapter,
    RevokeTokenParams,
} from '../lib/revokerTypes';

const { HTTP_STATUS_OK } = constants;

const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';

/** 탈퇴 흐름이 provider 응답을 오래 붙잡지 않도록 하는 revoke 요청 타임아웃(ms). */
const REVOKE_TIMEOUT_MS = 5000;

/**
 * Google 토큰 revoke 엔드포인트 어댑터. 토큰은 URL 쿼리가 아니라 form 본문으로
 * 보내 프록시·액세스 로그에 평문 토큰이 남지 않게 한다.
 * `compositeOAuthRevoker`가 provider 키로 선택해 호출한다.
 */
export const googleOAuthRevokerAdapter: OAuthRevokerAdapter = {
    async revokeToken({ accessToken }: RevokeTokenParams): Promise<void> {
        const response = await fetch(REVOKE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ token: accessToken }),
            signal: AbortSignal.timeout(REVOKE_TIMEOUT_MS),
        });
        if (response.status !== HTTP_STATUS_OK) {
            throw new Error(
                `Google token revocation failed with status ${response.status}`
            );
        }
    },
};
