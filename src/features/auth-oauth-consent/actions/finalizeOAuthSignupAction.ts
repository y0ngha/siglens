'use server';

import { redirect } from 'next/navigation';
import { localeHref, localeRedirect } from '@/shared/i18n/localeRedirect';
import type { FinalizeOAuthSignupState } from '@/shared/lib/auth/formTypes';
import {
    resolvePostSignupDestination,
    sanitizeNextPath,
    toSameOriginPath,
} from '@/shared/lib/auth/redirect';
import { createSignupConversionCookie } from '@/shared/lib/googleAds';
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
import { toHandoffAwareRedirect } from '@/entities/auth/lib/handoffStore';
import { createPendingOAuthSignupStoreFromEnv } from '@/entities/oauth-account';
import { DrizzleAgreementRepository } from '@/entities/agreement';
import { DrizzleTermsRepository } from '@/entities/terms/api';
import { cookies } from 'next/headers';
import { DEFAULT_LOCALE } from '@/shared/i18n/locales';

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
            // 신원(`terms.id`)만 필요하다 — 동의 레코드는 로케일과 무관한
            // 원본 행을 가리킨다. 본문을 쓰지 않으므로 기본 로케일로 조회한다.
            termsRepo.findActive('privacy', DEFAULT_LOCALE),
            termsRepo.findActive('tos', DEFAULT_LOCALE),
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
        // 신규 계정 생성이 확정된 뒤에만 도달한다 — 다음 페이지의 GoogleAdsTag가
        // 이 플래그를 읽어 가입 전환을 한 번 기록하고 지운다.
        cookieStore.set(createSignupConversionCookie({ secure }));

        // 리다이렉트 싱크 바로 앞에서 URL 파서로 같은-오리진 경로만 남긴다.
        // 문자열 검사(sanitizeNextPath)가 놓칠 수 있는 절대/프로토콜-상대 URL을
        // 파서가 호스트째로 떼어낸다.
        // ai 호스트에서 온 가입(SSO 핸드오프)은 하드 내비게이션이어야 한다 —
        // `toHandoffAwareRedirect` JSDoc 참고. 동기 `redirect`를 쓰는 이유는
        // localeRedirect.ts JSDoc 참고(아래 catch가 NEXT_REDIRECT를 재throw).
        redirect(
            toHandoffAwareRedirect(
                await localeHref(
                    toSameOriginPath(
                        resolvePostSignupDestination(
                            sanitizeNextPath(consumed.next)
                        )
                    )
                )
            )
        );
    } catch (err) {
        // Re-throw Next.js redirect (not an error — it's a control-flow signal).
        if (err instanceof Error && err.message.startsWith('NEXT_REDIRECT')) {
            throw err;
        }
        return localeRedirect(OAUTH_ERROR_REDIRECT.serviceUnavailable);
    }
}
