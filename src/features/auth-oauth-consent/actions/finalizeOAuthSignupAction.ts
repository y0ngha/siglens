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
import { createFunnelSignupCookie } from '@/shared/lib/funnel/signupCookie';
import { applyAuthCookie } from '@/entities/auth/lib/applyAuthCookie';
import { createAuthHintCookie } from '@/entities/auth/lib/authHintCookie';
import {
    CONSENT_REQUIRED_MESSAGE,
    OAUTH_ERROR_REDIRECT,
} from '@/entities/auth/lib/errorMessages';
import {
    createAuthSession,
    DEFAULT_SESSION_TTL_SECONDS,
} from '@/entities/auth/lib/sessionCookie';
import { isSecureCookieEnv } from '@/entities/auth/lib/sessionCookieOptions';
import {
    DrizzleSessionRepository,
    DrizzleUserRepository,
} from '@/entities/auth/api';
import { getDatabaseClient } from '@/shared/db/client';
import type { SiglensDatabase } from '@/shared/db/types';
import { toHandoffAwareRedirect } from '@/entities/auth/lib/handoffStore';
import {
    createPendingOAuthSignupStoreFromEnv,
    type PendingOAuthSignup,
} from '@/entities/oauth-account/lib/pendingOAuthSignupStore';
import { DrizzleAgreementRepository } from '@/entities/agreement/api';
import { DrizzleTermsRepository } from '@/entities/terms/api';
import { cookies } from 'next/headers';
import { DEFAULT_LOCALE } from '@/shared/i18n/locales';
import { isNextRedirectError } from '@/shared/lib/isNextRedirectError';
import { readConsentForm } from '../lib/readConsentForm';

interface ActiveTermsIds {
    privacy: string;
    tos: string;
}

/** 실패한 단계는 보낼 오류 페이지 경로를 싣는다. */
type SignupStep<T> = { ok: true; value: T } | { ok: false; redirectTo: string };

async function findActiveTermsIds(
    db: SiglensDatabase
): Promise<ActiveTermsIds | null> {
    const termsRepo = new DrizzleTermsRepository(db);
    const [privacy, tos] = await Promise.all([
        // 신원(`terms.id`)만 필요하다 — 동의 레코드는 로케일과 무관한
        // 원본 행을 가리킨다. 본문을 쓰지 않으므로 기본 로케일로 조회한다.
        termsRepo.findActive('privacy', DEFAULT_LOCALE),
        termsRepo.findActive('tos', DEFAULT_LOCALE),
    ]);
    if (!privacy || !tos) return null;
    return { privacy: privacy.id, tos: tos.id };
}

/**
 * 계정과 약관 동의 기록을 함께 만든다. 동의 기록이 실패하면 방금 만든 계정을
 * 지운다 — 동의 없는 계정이 남으면 안 된다.
 */
async function createUserWithAgreements(
    db: SiglensDatabase,
    profile: PendingOAuthSignup,
    terms: ActiveTermsIds
): Promise<SignupStep<string>> {
    const userRepo = new DrizzleUserRepository(db);

    const conflict = await userRepo.findByEmail(profile.email);
    if (conflict) {
        return { ok: false, redirectTo: OAUTH_ERROR_REDIRECT.emailConflict };
    }

    const createdUser = await userRepo.createOAuthUser({
        email: profile.email,
        provider: profile.provider,
        providerAccountId: profile.providerAccountId,
        name: profile.name,
        avatarUrl: profile.avatarUrl,
        accessToken: profile.accessToken,
        refreshToken: profile.refreshToken,
        tokenExpiresAt: profile.tokenExpiresAt
            ? new Date(profile.tokenExpiresAt)
            : undefined,
    });
    if (!createdUser) {
        return { ok: false, redirectTo: OAUTH_ERROR_REDIRECT.emailConflict };
    }

    const agreedAt = new Date();
    try {
        await new DrizzleAgreementRepository(db).insertMany(
            [terms.privacy, terms.tos].map(termsId => ({
                userId: createdUser.id,
                termsId,
                agreed: true,
                agreedAt,
            }))
        );
    } catch {
        await userRepo.deleteUser(createdUser.id);
        return {
            ok: false,
            redirectTo: OAUTH_ERROR_REDIRECT.serviceUnavailable,
        };
    }
    return { ok: true, value: createdUser.id };
}

/** 새 계정의 세션을 열고, 다음 페이지가 읽을 1회성 플래그 쿠키를 함께 심는다. */
async function issueSignupCookies(
    db: SiglensDatabase,
    userId: string
): Promise<void> {
    const secure = isSecureCookieEnv();
    const { cookie } = await createAuthSession({
        userId,
        sessions: new DrizzleSessionRepository(db),
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
    // 다음 페이지의 `FunnelSignupPing`이 읽어 `signup_completed`를 보내고 지운다.
    cookieStore.set(createFunnelSignupCookie({ method: 'oauth', secure }));
}

/**
 * 가입 완료 후 갈 곳. 리다이렉트 싱크 바로 앞에서 URL 파서로 같은-오리진 경로만
 * 남긴다 — 문자열 검사(sanitizeNextPath)가 놓칠 수 있는 절대/프로토콜-상대 URL을
 * 파서가 호스트째로 떼어낸다. ai 호스트에서 온 가입(SSO 핸드오프)은 하드
 * 내비게이션이어야 한다 — `toHandoffAwareRedirect` JSDoc 참고.
 */
async function postSignupHref(next: string): Promise<string> {
    return toHandoffAwareRedirect(
        await localeHref(
            toSameOriginPath(
                resolvePostSignupDestination(sanitizeNextPath(next))
            )
        )
    );
}

/**
 * OAuth 동의 화면의 "가입 완료" Server Action. 대기 중인 가입 토큰을 소비해 계정·약관
 * 동의·세션을 만들고 원래 가려던 곳으로 보낸다. 약관 미동의만 폼 상태로 돌려주고,
 * 그 밖의 실패(토큰 만료·이메일 충돌·저장소 장애)는 오류 쿼리를 단 로그인 화면으로 보낸다.
 */
export async function finalizeOAuthSignupAction(
    _prev: FinalizeOAuthSignupState,
    formData: FormData
): Promise<FinalizeOAuthSignupState> {
    try {
        const { token, agreed } = readConsentForm(formData);
        if (!token) {
            return localeRedirect(OAUTH_ERROR_REDIRECT.consentInvalid);
        }
        if (!agreed) {
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
        if (!(await store.peek(token))) {
            return localeRedirect(OAUTH_ERROR_REDIRECT.consentExpired);
        }

        const { db } = getDatabaseClient();
        // 약관을 먼저 확인한다 — 토큰은 1회용이라, 소비한 뒤 약관 조회가 실패하면
        // 사용자가 OAuth를 처음부터 다시 해야 한다.
        const terms = await findActiveTermsIds(db);
        if (!terms) {
            return localeRedirect(OAUTH_ERROR_REDIRECT.serviceUnavailable);
        }

        const consumed = await store.consume(token);
        if (!consumed) {
            return localeRedirect(OAUTH_ERROR_REDIRECT.consentExpired);
        }

        const created = await createUserWithAgreements(db, consumed, terms);
        if (!created.ok) {
            return localeRedirect(created.redirectTo);
        }

        await issueSignupCookies(db, created.value);

        // 동기 `redirect`를 쓰는 이유는 localeRedirect.ts JSDoc 참고(아래 catch가
        // NEXT_REDIRECT를 재throw).
        redirect(await postSignupHref(consumed.next));
    } catch (err) {
        // Re-throw Next.js redirect (not an error — it's a control-flow signal).
        if (isNextRedirectError(err)) throw err;
        return localeRedirect(OAUTH_ERROR_REDIRECT.serviceUnavailable);
    }
}
