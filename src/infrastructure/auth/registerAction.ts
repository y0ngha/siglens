'use server';

import { DrizzleSessionRepository } from '@/infrastructure/db/sessionRepository';
import { DrizzleTermsRepository } from '@/infrastructure/db/termsRepository';
import { DrizzleUserRepository } from '@/infrastructure/db/userRepository';
import {
    bcryptPasswordHasher,
    bcryptPasswordVerifier,
} from '@/infrastructure/auth/bcrypt';
import { loginUser } from '@/infrastructure/auth/use-cases/loginUser';
import { registerUser } from '@/infrastructure/auth/use-cases/registerUser';
import { createEmailTokenStore } from '@/infrastructure/email/tokenStore';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { SignupFormState } from '@/domain/auth/formTypes';
import { sanitizeNextPath } from '@/domain/auth/redirect';
import { applyAuthCookie } from '@/infrastructure/auth/applyAuthCookie';
import { getAuthDatabaseClient } from '@/infrastructure/auth/db';
import { AUTH_SERVICE_UNAVAILABLE_MESSAGE } from '@/infrastructure/auth/errorMessages';
import { isSecureCookieEnv } from '@/infrastructure/auth/sessionCookieOptions';
import { createAuthHintCookie } from '@/infrastructure/auth/authHintCookie';
import { DEFAULT_SESSION_TTL_SECONDS } from '@/infrastructure/auth/sessionCookie';

const AUTO_LOGIN_FAILED_MESSAGE =
    '회원가입은 완료되었으나 자동 로그인에 실패했습니다. 로그인 페이지에서 다시 시도해주세요.';
const CONSENT_REQUIRED_MESSAGE = '개인정보처리방침과 이용약관에 동의해주세요.';

export async function registerAction(
    _prev: SignupFormState,
    formData: FormData
): Promise<SignupFormState> {
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
            termsRepo.findActive('privacy'),
            termsRepo.findActive('tos'),
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
                passwordHasher: bcryptPasswordHasher,
                emailTokens,
                db,
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

        const loginResult = await loginUser(
            { email, password },
            {
                users: userRepo,
                sessions: new DrizzleSessionRepository(db),
                passwordVerifier: bcryptPasswordVerifier,
            },
            { secureCookie: isSecureCookieEnv() }
        );

        if (!loginResult.ok) {
            return {
                error: {
                    code: 'auto_login_failed',
                    message: AUTO_LOGIN_FAILED_MESSAGE,
                },
            };
        }

        const cookieStore = await cookies();
        cookieStore.set(applyAuthCookie(loginResult.cookie));
        cookieStore.set(
            createAuthHintCookie({
                maxAgeSeconds: DEFAULT_SESSION_TTL_SECONDS,
                secure: isSecureCookieEnv(),
            })
        );
        redirect(next);
    } catch (err) {
        // Re-throw Next.js redirect (not an error — it's a control-flow signal).
        if (err instanceof Error && err.message.startsWith('NEXT_REDIRECT')) {
            throw err;
        }
        return {
            error: {
                code: 'service_unavailable',
                message: AUTH_SERVICE_UNAVAILABLE_MESSAGE,
            },
        };
    }
}
