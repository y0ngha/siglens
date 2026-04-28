import type { OAuthProviderAdapter, OAuthProfileResult } from './types';

const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';
const SCOPE = 'openid email profile';

interface GoogleTokenResponse {
    access_token?: string;
}

interface GoogleUserInfoResponse {
    sub?: string;
    email?: string;
    name?: string;
    picture?: string;
}

export const googleOAuthAdapter: OAuthProviderAdapter = {
    id: 'google',
    authorizeUrl({ state, redirectUri }) {
        const clientId = process.env.GOOGLE_CLIENT_ID ?? '';
        const params = new URLSearchParams({
            client_id: clientId,
            redirect_uri: redirectUri,
            response_type: 'code',
            scope: SCOPE,
            state,
            access_type: 'online',
            prompt: 'select_account',
        });
        return `${AUTHORIZE_URL}?${params.toString()}`;
    },
    async exchangeCodeForProfile({
        code,
        redirectUri,
    }): Promise<OAuthProfileResult> {
        const clientId = process.env.GOOGLE_CLIENT_ID ?? '';
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? '';
        const tokenResponse = await fetch(TOKEN_URL, {
            method: 'POST',
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                code,
                grant_type: 'authorization_code',
                redirect_uri: redirectUri,
            }),
        });
        if (!tokenResponse.ok)
            return { ok: false, reason: 'token_exchange_failed' };
        let tokenJson: GoogleTokenResponse;
        try {
            tokenJson = (await tokenResponse.json()) as GoogleTokenResponse;
        } catch {
            return { ok: false, reason: 'token_exchange_failed' };
        }
        if (!tokenJson.access_token)
            return { ok: false, reason: 'token_exchange_failed' };

        const userinfoResponse = await fetch(USERINFO_URL, {
            headers: { authorization: `Bearer ${tokenJson.access_token}` },
        });
        if (!userinfoResponse.ok)
            return { ok: false, reason: 'profile_fetch_failed' };
        let profile: GoogleUserInfoResponse;
        try {
            profile = (await userinfoResponse.json()) as GoogleUserInfoResponse;
        } catch {
            return { ok: false, reason: 'profile_fetch_failed' };
        }
        if (!profile.sub || !profile.email)
            return { ok: false, reason: 'email_missing' };

        return {
            ok: true,
            profile: {
                provider: 'google',
                providerAccountId: profile.sub,
                email: profile.email,
                name: profile.name,
                avatarUrl: profile.picture,
            },
        };
    },
};
