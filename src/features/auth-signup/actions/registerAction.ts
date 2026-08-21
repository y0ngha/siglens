'use server';

import { getTranslations } from 'next-intl/server';

import { localeHref } from '@/shared/i18n/localeRedirect';
import { redirect } from 'next/navigation';
import type { SignupFormState } from '@/shared/lib/auth/formTypes';
import {
    resolvePostSignupDestination,
    sanitizeNextPath,
} from '@/shared/lib/auth/redirect';
import {
    applyAuthCookie,
    createAuthHintCookie,
    AUTH_SERVICE_UNAVAILABLE_MESSAGE,
    CONSENT_REQUIRED_MESSAGE,
    DEFAULT_SESSION_TTL_SECONDS,
    isSecureCookieEnv,
    loginUser,
    registerUser,
} from '@/entities/auth';
import {
    DrizzleSessionRepository,
    DrizzleUserRepository,
} from '@/entities/auth/api';
import {
    bcryptPasswordHasher,
    bcryptPasswordVerifier,
} from '@/entities/auth/lib/bcrypt';
import { getAuthDatabaseClient } from '@/entities/auth/lib/db';
import { DrizzleAgreementRepository } from '@/entities/agreement';
import { DrizzleTermsRepository } from '@/entities/terms';
import { createEmailTokenStore } from '@/entities/email-token';
import { cookies } from 'next/headers';
import { DEFAULT_LOCALE } from '@/shared/i18n/locales';

export async function registerAction(
    _prev: SignupFormState,
    formData: FormData
): Promise<SignupFormState> {
    // 상태의 `message`가 그대로 화면에 뿌려지므로 요청 로케일로 만든다.
    const tAuth = await getTranslations('entities.auth.error');
    try {
        const email = String(formData.get('email') ?? '').trim();
        const password = String(formData.get('password') ?? '');
        const rawName = String(formData.get('name') ?? '').trim();
        const name = rawName ? rawName : undefined;
        const next = sanitizeNextPath(formData.get('next')?.toString());
        // null (field absent) and 'false' (unchecked) both fail the !== 'true' check
        const agreedPrivacy = formData.get('agreed_privacy');
        const agreedTos = formData.get('agreed_tos');

        if (agreedPrivacy !== 'true' || agreedTos !== 'true') {
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

        const { db } = getAuthDatabaseClient();
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

        const registerResult = await registerUser(
            {
                email,
                password,
                name,
                agreedTermsIds: [privacyTerms.id, tosTerms.id],
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
            resolvePostSignupDestination(next),
            'https://siglens.invalid'
        );
        // `localeHref`는 멱등이다 — `next`에 이미 접두사가 있으면 그대로,
        // 없으면(기본값 `/`) 현재 로케일을 붙인다. `localeRedirect`가 아니라
        // 동기 `redirect`를 쓰는 이유는 아래 catch가 NEXT_REDIRECT를 재throw해야
        // 하고, TypeScript가 `never` 반환으로 이후 코드를 도달 불가로 좁혀야 하기
        // 때문이다(localeRedirect.ts JSDoc 참고).
        redirect(
            await localeHref(`${target.pathname}${target.search}${target.hash}`)
        );
    } catch (err) {
        // Re-throw Next.js redirect (not an error — it's a control-flow signal).
        if (err instanceof Error && err.message.startsWith('NEXT_REDIRECT')) {
            throw err;
        }
        console.error('Error in registerAction:', err);
        return {
            error: {
                code: 'service_unavailable',
                message: AUTH_SERVICE_UNAVAILABLE_MESSAGE,
            },
        };
    }
}
