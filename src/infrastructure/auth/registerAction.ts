'use server';

import {
    DrizzleSessionRepository,
    DrizzleUserRepository,
    bcryptPasswordHasher,
    bcryptPasswordVerifier,
    createEmailTokenStore,
    loginUser,
    registerUser,
} from '@y0ngha/siglens-core';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { SignupFormState } from '@/domain/auth/formTypes';
import { sanitizeNextPath } from '@/domain/auth/redirect';
import { applyAuthCookie } from './applyAuthCookie';
import { getAuthDatabaseClient } from './db';
import { isSecureCookieEnv } from './sessionCookieOptions';

const AUTO_LOGIN_FAILED_MESSAGE =
    '회원가입은 완료되었으나 자동 로그인에 실패했습니다. 로그인 페이지에서 다시 시도해주세요.';
const REDIS_UNAVAILABLE_MESSAGE =
    '서비스가 일시적으로 동작하지 않습니다. 잠시 후 다시 시도해주세요.';

export async function registerAction(
    _prev: SignupFormState,
    formData: FormData
): Promise<SignupFormState> {
    const email = String(formData.get('email') ?? '').trim();
    const password = String(formData.get('password') ?? '');
    const rawName = String(formData.get('name') ?? '').trim();
    const name = rawName ? rawName : undefined;
    const next = sanitizeNextPath(formData.get('next')?.toString());

    const emailTokens = createEmailTokenStore();
    if (!emailTokens) {
        return {
            error: {
                code: 'email_not_verified',
                field: 'email',
                message: REDIS_UNAVAILABLE_MESSAGE,
            },
        };
    }

    const { db } = getAuthDatabaseClient();
    const userRepo = new DrizzleUserRepository(db);

    const registerResult = await registerUser(
        { email, password, name },
        { users: userRepo, passwordHasher: bcryptPasswordHasher, emailTokens }
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

    (await cookies()).set(applyAuthCookie(loginResult.cookie));
    redirect(next);
}
