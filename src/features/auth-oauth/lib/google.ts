/** Google OAuth 2.0 / OpenID Connect 어댑터 — 인가 URL을 만들고 code를 프로필로 바꾼다. */
import type { OAuthProviderAdapter, OAuthProfileResult } from './types';

const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';
const SCOPE = 'openid email profile';

/**
 * Google 왕복(토큰 교환, userinfo) 하나의 제한 시간. 없으면 멈춘 연결이 undici의
 * `headersTimeout` 기본값(300초)까지 OAuth 콜백을 붙잡는다. 있으면 콜백 라우트가
 * 사용자를 `oauth_profile_invalid`와 함께 /login으로 돌려보낸다.
 */
export const GOOGLE_REQUEST_TIMEOUT_MS = 10_000;

interface GoogleTokenResponse {
    access_token?: string;
}

interface GoogleUserInfoResponse {
    sub?: string;
    email?: string;
    name?: string;
    picture?: string;
}

/**
 * Google 엔드포인트를 불러 JSON 본문을 돌려준다. 네트워크 오류·시간 초과·2xx 아님·
 * 파싱 실패는 모두 `null`이다. 어댑터 계약이 타입 있는 `OAuthProfileResult`라
 * 여기서 콜백 라우트로 예외가 새면 안 된다. 로그에는 단계와 상태만 남기고 응답
 * 본문은 남기지 않는다.
 */
async function fetchGoogleJson(
    step: 'token' | 'userinfo',
    url: string,
    init: RequestInit
): Promise<unknown> {
    try {
        const response = await fetch(url, {
            ...init,
            signal: AbortSignal.timeout(GOOGLE_REQUEST_TIMEOUT_MS),
        });
        if (!response.ok) {
            console.error(
                `[googleOAuthAdapter] ${step} request failed with status ${response.status}`
            );
            return null;
        }
        const body: unknown = await response.json();
        return body;
    } catch (error) {
        console.error(`[googleOAuthAdapter] ${step} request failed:`, error);
        return null;
    }
}

/** 인가 code를 액세스 토큰으로 바꾼다. Google이 토큰을 주지 않으면 `null`. */
async function requestAccessToken(
    code: string,
    redirectUri: string
): Promise<string | null> {
    const body = await fetchGoogleJson('token', TOKEN_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID ?? '',
            client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
            code,
            grant_type: 'authorization_code',
            redirect_uri: redirectUri,
        }),
    });
    // 토큰 엔드포인트 응답은 { access_token, ... }다. 필드는 모두 선택으로 보고 호출부가 검사한다.
    return (body as GoogleTokenResponse | null)?.access_token || null;
}

/** 액세스 토큰으로 OpenID userinfo를 읽는다. 요청이 실패하면 `null`. */
async function requestUserInfo(
    accessToken: string
): Promise<GoogleUserInfoResponse | null> {
    const body = await fetchGoogleJson('userinfo', USERINFO_URL, {
        headers: { authorization: `Bearer ${accessToken}` },
    });
    // userinfo 응답은 { sub, email, name, picture }다. 필수인 sub·email은 호출부가 검사한다.
    return body as GoogleUserInfoResponse | null;
}

/** 운영용 Google 어댑터. E2E가 아니면 `getOAuthAdapter`가 이것을 고른다. */
export const googleOAuthAdapter: OAuthProviderAdapter = {
    id: 'google',
    authorizeUrl({ state, redirectUri }) {
        const params = new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID ?? '',
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
        const accessToken = await requestAccessToken(code, redirectUri);
        if (!accessToken) return { ok: false, reason: 'token_exchange_failed' };

        const profile = await requestUserInfo(accessToken);
        if (!profile) return { ok: false, reason: 'profile_fetch_failed' };
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
