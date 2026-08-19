'use server';

import { localeRedirect } from '@/shared/i18n/localeRedirect';
import type { FinalizeOAuthSignupState } from '@/shared/lib/auth/formTypes';
import {
    resolvePostSignupDestination,
    sanitizeNextPath,
} from '@/shared/lib/auth/redirect';
import {
    applyAuthCookie,
    createAuthHintCookie,
    CONSENT_REQUIRED_MESSAGE,
    OAUTH_ERROR_REDIRECT,
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
import { DrizzleAgreementRepository } from '@/entities/agreement';
import { DrizzleTermsRepository } from '@/entities/terms';
import { cookies } from 'next/headers';

export async function finalizeOAuthSignupAction(
    _prev: FinalizeOAuthSignupState,
    formData: FormData
): Promise<FinalizeOAuthSignupState> {
    try {
        const token = String(formData.get('token') ?? '').trim();
        const agreedPrivacy = String(formData.get('agreed_privacy') ?? '');
        const agreedTos = String(formData.get('agreed_tos') ?? '');

        if (!token) {
            return localeRedirect(OAUTH_ERROR_REDIRECT.consentInvalid);
        }

        if (agreedPrivacy !== 'true' || agreedTos !== 'true') {
            return {
                error: {
                    code: 'consent_required',
                    message: CONSENT_REQUIRED_MESSAGE,
                },
            };
        }

        const store = createPendingOAuthSignupStoreFromEnv();
        if (!store) {
            return localeRedirect(OAUTH_ERROR_REDIRECT.serviceUnavailable);
        }

        const profile = await store.peek(token);
        if (!profile) {
            return localeRedirect(OAUTH_ERROR_REDIRECT.consentExpired);
        }

        const { db } = getAuthDatabaseClient();
        const termsRepo = new DrizzleTermsRepository(db);
        const [termsP, termsT] = await Promise.all([
            termsRepo.findActive('privacy'),
            termsRepo.findActive('tos'),
        ]);
        if (!termsP || !termsT) {
            return localeRedirect(OAUTH_ERROR_REDIRECT.serviceUnavailable);
        }

        const consumed = await store.consume(token);
        if (!consumed) {
            return localeRedirect(OAUTH_ERROR_REDIRECT.consentExpired);
        }

        const userRepo = new DrizzleUserRepository(db);
        const sessionRepo = new DrizzleSessionRepository(db);

        const conflict = await userRepo.findByEmail(consumed.email);
        if (conflict) {
            return localeRedirect(OAUTH_ERROR_REDIRECT.emailConflict);
        }

        const createdUser = await userRepo.createOAuthUser({
            email: consumed.email,
            provider: consumed.provider,
            providerAccountId: consumed.providerAccountId,
            name: consumed.name,
            avatarUrl: consumed.avatarUrl,
            accessToken: consumed.accessToken,
            refreshToken: consumed.refreshToken,
            tokenExpiresAt: consumed.tokenExpiresAt
                ? new Date(consumed.tokenExpiresAt)
                : undefined,
        });

        if (!createdUser) {
            return localeRedirect(OAUTH_ERROR_REDIRECT.emailConflict);
        }

        const agreementRepo = new DrizzleAgreementRepository(db);
        const now = new Date();
        try {
            await agreementRepo.insertMany([
                {
                    userId: createdUser.id,
                    termsId: termsP.id,
                    agreed: true,
                    agreedAt: now,
                },
                {
                    userId: createdUser.id,
                    termsId: termsT.id,
                    agreed: true,
                    agreedAt: now,
                },
            ]);
        } catch {
            await userRepo.deleteUser(createdUser.id);
            return localeRedirect(OAUTH_ERROR_REDIRECT.serviceUnavailable);
        }

        const secure = isSecureCookieEnv();
        const { cookie } = await createAuthSession({
            userId: createdUser.id,
            sessions: sessionRepo,
            now: new Date(),
            secureCookie: secure,
        });

        const cookieStore = await cookies();
        cookieStore.set(applyAuthCookie(cookie));
        cookieStore.set(
            createAuthHintCookie({
                maxAgeSeconds: DEFAULT_SESSION_TTL_SECONDS,
                secure,
            })
        );

        // 리다이렉트 싱크 바로 앞에서 URL 파서로 같은-오리진 경로만 남긴다.
        // 문자열 검사(sanitizeNextPath)가 놓칠 수 있는 절대/프로토콜-상대 URL을 파서가
        // 호스트째로 떼어낸다. base 호스트는 결과에 쓰이지 않는 더미다.
        const target = new URL(
            resolvePostSignupDestination(sanitizeNextPath(consumed.next)),
            'https://siglens.invalid'
        );
        return localeRedirect(
            `${target.pathname}${target.search}${target.hash}`
        );
    } catch (err) {
        // Re-throw Next.js redirect (not an error — it's a control-flow signal).
        if (err instanceof Error && err.message.startsWith('NEXT_REDIRECT')) {
            throw err;
        }
        return localeRedirect(OAUTH_ERROR_REDIRECT.serviceUnavailable);
    }
}
