import { NextResponse } from 'next/server';
import { createPendingOAuthSignupStoreFromEnv } from '@/entities/oauth-account/server/pendingOAuthSignupStore';
import { getOAuthRedirectBaseUrl } from '@/features/auth-oauth/lib/providers';
import { expiredOAuthStateCookie } from '@/features/auth-oauth/lib/state';
import type { OAuthProfileResult } from '@/features/auth-oauth/lib/types';
import { localePath } from '@/shared/i18n/locales';
import type { SupportedOAuthProvider } from '@/shared/lib/types';
import { localeFromNext, redirectToLoginWithError } from './loginRedirect';

/** 프로필 교환에 성공한 결과에서 꺼낸 프로필. */
export type OAuthProfile = Extract<OAuthProfileResult, { ok: true }>['profile'];

/**
 * 가입 전인 OAuth 프로필을 임시 저장소에 맡기고 약관 동의 화면으로 보낸다. 토큰만 URL에 싣는다.
 * 저장소가 설정되지 않았거나 저장이 실패하면 `oauth_unknown`으로 로그인 화면에 돌려보낸다.
 */
export async function redirectToConsent(
    provider: SupportedOAuthProvider,
    profile: OAuthProfile,
    next: string
): Promise<NextResponse> {
    const pendingStore = createPendingOAuthSignupStoreFromEnv();
    if (!pendingStore) {
        return redirectToLoginWithError('oauth_unknown', undefined, next);
    }

    const token = await pendingStore
        .save({
            provider,
            email: profile.email,
            providerAccountId: profile.providerAccountId,
            name: profile.name,
            avatarUrl: profile.avatarUrl,
            accessToken: profile.accessToken ?? '',
            refreshToken: profile.refreshToken,
            tokenExpiresAt: profile.tokenExpiresAt?.toISOString(),
            next,
            createdAt: new Date().toISOString(),
        })
        .catch(() => null);
    if (!token) {
        return redirectToLoginWithError('oauth_unknown', undefined, next);
    }

    const consentUrl = new URL(
        localePath(localeFromNext(next), '/signup/oauth/consent'),
        getOAuthRedirectBaseUrl()
    );
    consentUrl.searchParams.set('token', token);
    const response = NextResponse.redirect(consentUrl);
    response.cookies.set(expiredOAuthStateCookie());
    return response;
}
