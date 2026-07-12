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
import { sanitizeNextPath } from '@/shared/lib/auth/redirect';

interface CallbackRouteParams {
    params: Promise<{ provider: string }>;
}

function redirectToLoginWithError(code: string, email?: string): NextResponse {
    const url = new URL('/login', getOAuthRedirectBaseUrl());
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
        return redirectToLoginWithError('oauth_profile_invalid');
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
            profileResult.profile.email
        );
    }

    const pendingStore = createPendingOAuthSignupStoreFromEnv();
    if (!pendingStore) {
        return redirectToLoginWithError('oauth_unknown');
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
    if (!token) return redirectToLoginWithError('oauth_unknown');

    const consentUrl = new URL(
        '/signup/oauth/consent',
        getOAuthRedirectBaseUrl()
    );
    consentUrl.searchParams.set('token', token);
    const response = NextResponse.redirect(consentUrl);
    response.cookies.set(expiredOAuthStateCookie());
    return response;
}
