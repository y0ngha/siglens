import { NextResponse, type NextRequest } from 'next/server';
import {
    DrizzleSessionRepository,
    DrizzleUserRepository,
    socialLoginUser,
} from '@y0ngha/siglens-core';
import { applyAuthCookie } from '@/infrastructure/auth/applyAuthCookie';
import { getAuthDatabaseClient } from '@/infrastructure/auth/db';
import {
    buildOAuthRedirectUri,
    getOAuthAdapter,
    isOAuthProvider,
} from '@/infrastructure/auth/oauth/providers';
import {
    OAUTH_STATE_COOKIE_NAME,
    expiredOAuthStateCookie,
    verifyOAuthState,
} from '@/infrastructure/auth/oauth/state';
import { isSecureCookieEnv } from '@/infrastructure/auth/sessionCookieOptions';

interface CallbackRouteParams {
    params: Promise<{ provider: string }>;
}

function redirectToLoginWithError(
    req: NextRequest,
    code: string,
    email?: string
): NextResponse {
    const url = new URL('/login', req.url);
    url.searchParams.set('error', code);
    if (email) url.searchParams.set('email', email);
    const response = NextResponse.redirect(url);
    response.cookies.set(expiredOAuthStateCookie());
    return response;
}

export async function GET(req: NextRequest, { params }: CallbackRouteParams) {
    const { provider } = await params;
    if (!isOAuthProvider(provider)) {
        return redirectToLoginWithError(req, 'oauth_unknown');
    }

    const queryState = req.nextUrl.searchParams.get('state');
    const code = req.nextUrl.searchParams.get('code');
    const stateCookie = req.cookies.get(OAUTH_STATE_COOKIE_NAME)?.value;

    if (!queryState || !code) {
        return redirectToLoginWithError(req, 'oauth_unknown');
    }

    const stateResult = verifyOAuthState(provider, queryState, stateCookie);
    if (!stateResult.ok) {
        return redirectToLoginWithError(req, 'oauth_unknown');
    }

    const redirectUri = buildOAuthRedirectUri(provider);
    const profileResult = await getOAuthAdapter(
        provider
    ).exchangeCodeForProfile({ code, redirectUri });
    if (!profileResult.ok) {
        return redirectToLoginWithError(req, 'oauth_profile_invalid');
    }

    const { db } = getAuthDatabaseClient();
    const result = await socialLoginUser(
        profileResult.profile,
        {
            users: new DrizzleUserRepository(db),
            sessions: new DrizzleSessionRepository(db),
        },
        { secureCookie: isSecureCookieEnv() }
    );

    if (!result.ok) {
        if (result.error.code === 'email_already_exists') {
            return redirectToLoginWithError(
                req,
                'oauth_email_conflict',
                profileResult.profile.email
            );
        }
        return redirectToLoginWithError(req, 'oauth_profile_invalid');
    }

    const response = NextResponse.redirect(new URL(stateResult.next, req.url));
    response.cookies.set(applyAuthCookie(result.cookie));
    response.cookies.set(expiredOAuthStateCookie());
    return response;
}
