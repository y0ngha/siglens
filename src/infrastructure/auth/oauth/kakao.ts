import type { OAuthProviderAdapter, OAuthProfileResult } from './types';

const AUTHORIZE_URL = 'https://kauth.kakao.com/oauth/authorize';
const TOKEN_URL = 'https://kauth.kakao.com/oauth/token';
const USER_URL = 'https://kapi.kakao.com/v2/user/me';
const SCOPE = 'account_email profile_nickname profile_image';

interface KakaoTokenResponse {
    access_token?: string;
}

interface KakaoUserResponse {
    id?: number;
    kakao_account?: {
        email?: string;
        profile?: {
            nickname?: string;
            profile_image_url?: string;
        };
    };
}

export const kakaoOAuthAdapter: OAuthProviderAdapter = {
    id: 'kakao',
    authorizeUrl({ state, redirectUri }) {
        const clientId = process.env.KAKAO_REST_API_KEY ?? '';
        const params = new URLSearchParams({
            client_id: clientId,
            redirect_uri: redirectUri,
            response_type: 'code',
            scope: SCOPE,
            state,
        });
        return `${AUTHORIZE_URL}?${params.toString()}`;
    },
    async exchangeCodeForProfile({
        code,
        redirectUri,
    }): Promise<OAuthProfileResult> {
        const clientId = process.env.KAKAO_REST_API_KEY ?? '';
        const clientSecret = process.env.KAKAO_CLIENT_SECRET;
        const tokenBody = new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: clientId,
            redirect_uri: redirectUri,
            code,
        });
        if (clientSecret) tokenBody.set('client_secret', clientSecret);
        const tokenResponse = await fetch(TOKEN_URL, {
            method: 'POST',
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            body: tokenBody,
        });
        if (!tokenResponse.ok)
            return { ok: false, reason: 'token_exchange_failed' };
        let tokenJson: KakaoTokenResponse;
        try {
            tokenJson = (await tokenResponse.json()) as KakaoTokenResponse;
        } catch {
            return { ok: false, reason: 'token_exchange_failed' };
        }
        if (!tokenJson.access_token)
            return { ok: false, reason: 'token_exchange_failed' };

        const userResponse = await fetch(USER_URL, {
            headers: { authorization: `Bearer ${tokenJson.access_token}` },
        });
        if (!userResponse.ok)
            return { ok: false, reason: 'profile_fetch_failed' };
        let user: KakaoUserResponse;
        try {
            user = (await userResponse.json()) as KakaoUserResponse;
        } catch {
            return { ok: false, reason: 'profile_fetch_failed' };
        }
        const account = user.kakao_account;
        if (typeof user.id !== 'number' || !account?.email)
            return { ok: false, reason: 'email_missing' };

        return {
            ok: true,
            profile: {
                provider: 'kakao',
                providerAccountId: String(user.id),
                email: account.email,
                name: account.profile?.nickname,
                avatarUrl: account.profile?.profile_image_url,
            },
        };
    },
};
