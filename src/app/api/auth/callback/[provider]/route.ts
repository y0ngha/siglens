import { NextResponse, type NextRequest } from 'next/server';
import {
    applyAuthCookie,
    createAuthHintCookie,
    createAuthSession,
    DEFAULT_SESSION_TTL_SECONDS,
    isSecureCookieEnv,
} from '@/entities/auth';
import {
    DrizzleSessionRepository,
    DrizzleUserRepository,
} from '@/entities/auth/api';
import { getAuthDatabaseClient } from '@/entities/auth/lib/db';
import { createPendingOAuthSignupStoreFromEnv } from '@/entities/oauth-account';
import {
    buildOAuthRedirectUri,
    getOAuthAdapter,
    getOAuthRedirectBaseUrl,
    isOAuthProvider,
    OAUTH_STATE_COOKIE_NAME,
    OAuthStateSecretMisconfiguredError,
    expiredOAuthStateCookie,
    verifyOAuthState,
} from '@/features/auth-oauth';
import { localePath, splitLocalePath } from '@/shared/i18n/locales';
import { sanitizeNextPath } from '@/shared/lib/auth/redirect';

interface CallbackRouteParams {
    params: Promise<{ provider: string }>;
}

/**
 * `/api/*`는 next-intl 매처에서 제외돼 있어(`proxy.ts`) 이 핸들러에는 로케일이
 * 없다. 그런데 여기서 리다이렉트하는 대상은 API 소비자가 아니라 **사용자가 볼
 * 앱 페이지**다. 로케일을 잃으면 `/en/login`에서 시작한 사용자가 OAuth 왕복 후
 * 한국어 페이지에 떨어진다.
 *
 * 로케일은 state에 실린 `next`에서 복원한다 — `LoginContent`/`SignupContent`가
 * 접두사를 붙여 넣기 때문이다. state 검증 전에 실패한 경우(`next` 없음)에만
 * 기본 로케일로 떨어지는데, 그건 애초에 복원할 근거가 없는 자리다.
 */
function localeFromNext(next: string | undefined) {
    return splitLocalePath(next).locale;
}

function redirectToLoginWithError(
    code: string,
    email?: string,
    next?: string
): NextResponse {
    const url = new URL(
        localePath(localeFromNext(next), '/login'),
        getOAuthRedirectBaseUrl()
    );
    url.searchParams.set('error', code);
    if (email) url.searchParams.set('email', email);
    const response = NextResponse.redirect(url);
    response.cookies.set(expiredOAuthStateCookie());
    return response;
}

export async function GET(
    req: NextRequest,
    { params }: CallbackRouteParams
): Promise<NextResponse> {
    const { provider } = await params;
    if (!isOAuthProvider(provider)) {
        return redirectToLoginWithError('oauth_unknown');
    }

    const queryState = req.nextUrl.searchParams.get('state');
    const code = req.nextUrl.searchParams.get('code');
    const stateCookie = req.cookies.get(OAUTH_STATE_COOKIE_NAME)?.value;

    if (!queryState || !code) {
        return redirectToLoginWithError('oauth_unknown');
    }

    let stateResult;
    try {
        stateResult = verifyOAuthState(provider, queryState, stateCookie);
    } catch (error) {
        if (error instanceof OAuthStateSecretMisconfiguredError) {
            // Fail closed: when the HMAC secret is misconfigured, refuse the callback
            // rather than fall back to unsigned validation.
            return redirectToLoginWithError('oauth_unknown');
        }
        throw error;
    }
    if (!stateResult.ok) {
        return redirectToLoginWithError('oauth_unknown');
    }

    const redirectUri = buildOAuthRedirectUri(provider);
    const profileResult = await getOAuthAdapter(
        provider
    ).exchangeCodeForProfile({ code, redirectUri });
    if (!profileResult.ok) {
        return redirectToLoginWithError(
            'oauth_profile_invalid',
            undefined,
            stateResult.next
        );
    }

    const { db } = getAuthDatabaseClient();
    const userRepo = new DrizzleUserRepository(db);
    const sessionRepo = new DrizzleSessionRepository(db);

    const existingOAuthUser = await userRepo.findByOAuthAccount(
        profileResult.profile.provider,
        profileResult.profile.providerAccountId
    );
    if (existingOAuthUser !== null) {
        const secure = isSecureCookieEnv();
        const { cookie } = await createAuthSession({
            userId: existingOAuthUser.id,
            sessions: sessionRepo,
            now: new Date(),
            secureCookie: secure,
        });
        const response = NextResponse.redirect(
            new URL(
                sanitizeNextPath(stateResult.next),
                getOAuthRedirectBaseUrl()
            )
        );
        response.cookies.set(applyAuthCookie(cookie));
        response.cookies.set(
            createAuthHintCookie({
                maxAgeSeconds: DEFAULT_SESSION_TTL_SECONDS,
                secure,
            })
        );
        response.cookies.set(expiredOAuthStateCookie());
        return response;
    }

    const existingEmailUser = await userRepo.findByEmail(
        profileResult.profile.email
    );
    if (existingEmailUser !== null) {
        return redirectToLoginWithError(
            'oauth_email_conflict',
            profileResult.profile.email,
            stateResult.next
        );
    }

    const pendingStore = createPendingOAuthSignupStoreFromEnv();
    if (!pendingStore) {
        return redirectToLoginWithError(
            'oauth_unknown',
            undefined,
            stateResult.next
        );
    }

    // `provider` was already narrowed to SupportedOAuthProvider by isOAuthProvider() above.
    const token = await pendingStore
        .save({
            provider,
            email: profileResult.profile.email,
            providerAccountId: profileResult.profile.providerAccountId,
            name: profileResult.profile.name,
            avatarUrl: profileResult.profile.avatarUrl,
            accessToken: profileResult.profile.accessToken ?? '',
            refreshToken: profileResult.profile.refreshToken,
            tokenExpiresAt: profileResult.profile.tokenExpiresAt?.toISOString(),
            next: stateResult.next,
            createdAt: new Date().toISOString(),
        })
        .catch(() => null);
    if (!token)
        return redirectToLoginWithError(
            'oauth_unknown',
            undefined,
            stateResult.next
        );

    const consentUrl = new URL(
        localePath(localeFromNext(stateResult.next), '/signup/oauth/consent'),
        getOAuthRedirectBaseUrl()
    );
    consentUrl.searchParams.set('token', token);
    const response = NextResponse.redirect(consentUrl);
    response.cookies.set(expiredOAuthStateCookie());
    return response;
}
