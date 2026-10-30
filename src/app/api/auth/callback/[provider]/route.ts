import type { NextRequest, NextResponse } from 'next/server';
import { exchangeProfile } from '@/app/api/auth/callback/_lib/exchangeProfile';
import { redirectToConsent } from '@/app/api/auth/callback/_lib/redirectToConsent';
import { redirectSignedIn } from '@/app/api/auth/callback/_lib/redirectSignedIn';
import { redirectToLoginWithError } from '@/app/api/auth/callback/_lib/loginRedirect';
import { DrizzleUserRepository } from '@/entities/auth/api';
import { isOAuthProvider } from '@/features/auth-oauth/lib/providers';
import {
    OAUTH_STATE_COOKIE_NAME,
    OAuthStateSecretMisconfiguredError,
    verifyOAuthState,
} from '@/features/auth-oauth/lib/state';
import { getDatabaseClient } from '@/shared/db/client';

interface CallbackRouteParams {
    params: Promise<{ provider: string }>;
}

/**
 * OAuth 인가 코드 콜백 — state 쿠키·서명 검증 → 코드 교환 → 기존 계정이면 로그인, 이메일이
 * 겹치면 충돌 오류, 신규면 약관 동의 화면. 모든 실패는 로그인 화면의 `?error=` 코드로 돌아간다.
 */
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
            // HMAC 시크릿이 잘못 설정되면 서명 없는 검증으로 물러서지 않고 콜백을 거절한다.
            return redirectToLoginWithError('oauth_unknown');
        }
        throw error;
    }
    if (!stateResult.ok) {
        return redirectToLoginWithError('oauth_unknown');
    }

    const profileResult = await exchangeProfile(provider, code);
    if (!profileResult.ok) {
        return redirectToLoginWithError(
            'oauth_profile_invalid',
            undefined,
            stateResult.next
        );
    }

    const userRepo = new DrizzleUserRepository(getDatabaseClient().db);
    const existingOAuthUser = await userRepo.findByOAuthAccount(
        profileResult.profile.provider,
        profileResult.profile.providerAccountId
    );
    if (existingOAuthUser !== null) {
        return redirectSignedIn(existingOAuthUser.id, stateResult.next);
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

    return redirectToConsent(provider, profileResult.profile, stateResult.next);
}
