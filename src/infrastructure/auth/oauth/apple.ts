import { SignJWT, importPKCS8, decodeJwt } from 'jose';
import type { OAuthProviderAdapter, OAuthProfileResult } from './types';

const AUTHORIZE_URL = 'https://appleid.apple.com/auth/authorize';
const TOKEN_URL = 'https://appleid.apple.com/auth/token';
const SCOPE = 'email';
const CLIENT_SECRET_TTL_SECONDS = 60 * 5;

interface AppleTokenResponse {
    id_token?: string;
}

interface AppleIdTokenClaims {
    sub?: string;
    email?: string;
}

/** Apple `client_secret`을 ES256 JWT로 매 호출 동적 서명한다. */
async function signAppleClientSecret(): Promise<string> {
    const teamId = process.env.APPLE_TEAM_ID ?? '';
    const clientId = process.env.APPLE_CLIENT_ID ?? '';
    const keyId = process.env.APPLE_KEY_ID ?? '';
    const privateKeyPem = (process.env.APPLE_PRIVATE_KEY ?? '').replace(
        /\\n/g,
        '\n'
    );
    const privateKey = await importPKCS8(privateKeyPem, 'ES256');
    const nowSec = Math.floor(Date.now() / 1000);
    return new SignJWT({})
        .setProtectedHeader({ alg: 'ES256', kid: keyId })
        .setIssuer(teamId)
        .setAudience('https://appleid.apple.com')
        .setSubject(clientId)
        .setIssuedAt(nowSec)
        .setExpirationTime(nowSec + CLIENT_SECRET_TTL_SECONDS)
        .sign(privateKey);
}

export const appleOAuthAdapter: OAuthProviderAdapter = {
    id: 'apple',
    authorizeUrl({ state, redirectUri }) {
        const clientId = process.env.APPLE_CLIENT_ID ?? '';
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
        const clientId = process.env.APPLE_CLIENT_ID ?? '';
        let clientSecret: string;
        try {
            clientSecret = await signAppleClientSecret();
        } catch {
            return { ok: false, reason: 'token_exchange_failed' };
        }

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
        const tokenJson = (await tokenResponse.json()) as AppleTokenResponse;
        if (!tokenJson.id_token)
            return { ok: false, reason: 'token_exchange_failed' };

        let claims: AppleIdTokenClaims;
        try {
            claims = decodeJwt(tokenJson.id_token) as AppleIdTokenClaims;
        } catch {
            return { ok: false, reason: 'profile_fetch_failed' };
        }
        if (!claims.sub || !claims.email)
            return { ok: false, reason: 'email_missing' };

        return {
            ok: true,
            profile: {
                provider: 'apple',
                providerAccountId: claims.sub,
                email: claims.email,
            },
        };
    },
};
