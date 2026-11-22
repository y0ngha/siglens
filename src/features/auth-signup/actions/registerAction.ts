'use server';

import { localeHref } from '@/shared/i18n/localeRedirect';
import { getTranslations } from 'next-intl/server';

import { redirect } from 'next/navigation';
import type { SignupFormState } from '@/shared/lib/auth/formTypes';
import {
    resolvePostSignupDestination,
    toSameOriginPath,
} from '@/shared/lib/auth/redirect';
import { createSignupConversionCookie } from '@/shared/lib/googleAds';
import { createFunnelSignupCookie } from '@/shared/lib/funnel/signupCookie';
import { applyAuthCookie } from '@/entities/auth/lib/applyAuthCookie';
import { createExpiredSignupVerificationCookie } from '@/entities/auth/lib/signupVerificationCookie';
import { SIGNUP_VERIFICATION_COOKIE_NAME } from '@/shared/config/cookieNames';
import { createAuthHintCookie } from '@/entities/auth/lib/authHintCookie';
import { setMainSessionHint } from '@/entities/auth/lib/mainSessionHintCookie';
import {
    AUTH_SERVICE_UNAVAILABLE_MESSAGE,
    CONSENT_REQUIRED_MESSAGE,
} from '@/entities/auth/lib/errorMessages';
import { DEFAULT_SESSION_TTL_SECONDS } from '@/entities/auth/lib/sessionCookie';
import { isSecureCookieEnv } from '@/entities/auth/lib/sessionCookieOptions';
import { loginUser } from '@/entities/auth/lib/loginUser';
import { registerUser } from '@/entities/auth/lib/registerUser';
import {
    DrizzleSessionRepository,
    DrizzleUserRepository,
} from '@/entities/auth/api';
import {
    bcryptPasswordHasher,
    bcryptPasswordVerifier,
} from '@/entities/auth/lib/bcrypt';
import { getDatabaseClient } from '@/shared/db/client';
import { toHandoffAwareRedirect } from '@/entities/auth/lib/handoffRedirect';
import { DrizzleAgreementRepository } from '@/entities/agreement/api';
import { DrizzleTermsRepository } from '@/entities/terms/api';
import { createEmailTokenStore } from '@/entities/email-token/api';
import { cookies } from 'next/headers';
import { DEFAULT_LOCALE } from '@/shared/i18n/locales';
import { isNextRedirectError } from '@/shared/lib/isNextRedirectError';
import { readSignupEmailReportOptIn } from '@/entities/email-report/lib/signupOptIn';
import { recordSignupEmailReportOptIn } from '@/entities/email-report/server/recordSignupEmailReportOptIn';
import { resolveRequestLocale } from '@/shared/i18n/requestLocale';
import { readSignupForm } from '../lib/readSignupForm';
import { redactDbErrorForLog } from '@/shared/db/redactDbErrorForLog';

/**
 * 회원가입 3단계의 Server Action. 필수 동의 → 활성 약관 → `registerUser`
 * (이메일 인증 여부·중복 확인 포함) → 자동 로그인 순으로 진행하고, 성공하면
 * 세션·전환 쿠키를 심은 뒤 같은-오리진 경로로 리다이렉트한다. 실패는 폼 상태의
 * 오류 **코드**로 돌려주고, 예상하지 못한 예외의 내용은 로그에만 남긴다.
 */
export async function registerAction(
    _prev: SignupFormState,
    formData: FormData
): Promise<SignupFormState> {
    // 상태의 `message`가 그대로 화면에 뿌려지므로 요청 로케일로 만든다.
    const tAuth = await getTranslations('entities.auth.error');
    try {
        const { email, password, name, next, hasRequiredConsent } =
            readSignupForm(formData);
        const emailReportOptIn = readSignupEmailReportOptIn(formData);

        if (!hasRequiredConsent) {
            return {
                error: {
                    code: 'consent_required',
                    message: CONSENT_REQUIRED_MESSAGE,
                },
            };
        }

        const emailTokens = createEmailTokenStore();
        if (!emailTokens) {
            return {
                error: {
                    code: 'redis_unavailable',
                    message: AUTH_SERVICE_UNAVAILABLE_MESSAGE,
                },
            };
        }

        const { db } = getDatabaseClient();
        const termsRepo = new DrizzleTermsRepository(db);
        const [privacyTerms, tosTerms] = await Promise.all([
            // 신원(`terms.id`)만 필요하다 — 동의 레코드는 로케일과 무관한
            // 원본 행을 가리킨다. 본문을 쓰지 않으므로 기본 로케일로 조회한다.
            termsRepo.findActive('privacy', DEFAULT_LOCALE),
            termsRepo.findActive('tos', DEFAULT_LOCALE),
        ]);

        if (!privacyTerms || !tosTerms) {
            return {
                error: {
                    code: 'service_unavailable',
                    message: AUTH_SERVICE_UNAVAILABLE_MESSAGE,
                },
            };
        }

        const userRepo = new DrizzleUserRepository(db);
        const verificationBinding =
            (await cookies()).get(SIGNUP_VERIFICATION_COOKIE_NAME)?.value ??
            null;

        const registerResult = await registerUser(
            {
                email,
                password,
                name,
                agreedTermsIds: [privacyTerms.id, tosTerms.id],
                verificationBinding,
            },
            {
                users: userRepo,
                agreements: new DrizzleAgreementRepository(db),
                passwordHasher: bcryptPasswordHasher,
                emailTokens,
            }
        );

        if (!registerResult.ok) {
            return {
                error: {
                    code: registerResult.error.code,
                    field: registerResult.error.field,
                    message: registerResult.error.message,
                },
            };
        }

        // 선택 사항이라 실패해도 가입은 이어 간다(결과를 쓰지 않는다). 계정이 만들어진 뒤에만
        // 도달하므로 동의는 이 계정에 대해서만 기록된다.
        if (emailReportOptIn.optIn) {
            await recordSignupEmailReportOptIn(db, {
                userId: registerResult.user.id,
                timezone: emailReportOptIn.timezone,
                locale: await resolveRequestLocale(),
                source: 'signup_email',
            });
        }

        const secure = isSecureCookieEnv();
        const loginResult = await loginUser(
            { email, password },
            {
                users: userRepo,
                sessions: new DrizzleSessionRepository(db),
                passwordVerifier: bcryptPasswordVerifier,
            },
            { secureCookie: secure }
        );

        if (!loginResult.ok) {
            return {
                error: {
                    code: 'auto_login_failed',
                    message: tAuth('signupAutoLoginFailed'),
                },
            };
        }

        const cookieStore = await cookies();
        cookieStore.set(applyAuthCookie(loginResult.cookie));
        // 가입이 끝나 마커가 지워졌으니 역할을 다한 바인딩 쿠키도 지운다.
        cookieStore.set(createExpiredSignupVerificationCookie());
        cookieStore.set(
            createAuthHintCookie({
                maxAgeSeconds: DEFAULT_SESSION_TTL_SECONDS,
                secure,
            })
        );
        setMainSessionHint(cookieStore, { secure });
        // 신규 계정 생성이 확정된 뒤에만 도달한다 — 다음 페이지의 GoogleAdsTag가
        // 이 플래그를 읽어 가입 전환을 한 번 기록하고 지운다.
        cookieStore.set(createSignupConversionCookie({ secure }));
        // 다음 페이지의 `FunnelSignupPing`이 읽어 `signup_completed`를 보내고 지운다.
        cookieStore.set(createFunnelSignupCookie({ method: 'email', secure }));
        // 리다이렉트 싱크 바로 앞에서 URL 파서로 같은-오리진 경로만 남긴다.
        // 문자열 검사(sanitizeNextPath)가 놓칠 수 있는 절대/프로토콜-상대 URL을
        // 파서가 호스트째로 떼어낸다.
        // `localeHref`는 멱등이다 — `next`에 이미 접두사가 있으면 그대로,
        // 없으면(기본값 `/`) 현재 로케일을 붙인다. `localeRedirect`가 아니라
        // 동기 `redirect`를 쓰는 이유는 아래 catch가 NEXT_REDIRECT를 재throw해야
        // 하고, TypeScript가 `never` 반환으로 이후 코드를 도달 불가로 좁혀야 하기
        // 때문이다(localeRedirect.ts JSDoc 참고).
        // ai 호스트에서 온 가입(SSO 핸드오프)은 하드 내비게이션이어야 한다 —
        // `toHandoffAwareRedirect` JSDoc 참고.
        redirect(
            toHandoffAwareRedirect(
                await localeHref(
                    toSameOriginPath(resolvePostSignupDestination(next))
                )
            )
        );
    } catch (err) {
        // Re-throw Next.js redirect (not an error — it's a control-flow signal).
        if (isNextRedirectError(err)) throw err;
        console.error('Error in registerAction:', redactDbErrorForLog(err));
        return {
            error: {
                code: 'service_unavailable',
                message: AUTH_SERVICE_UNAVAILABLE_MESSAGE,
            },
        };
    }
}
