'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { DrizzleSessionRepository } from '@/entities/session';
import { DrizzleUserRepository } from '@/entities/user';
import { bcryptPasswordVerifier } from '@/infrastructure/auth/bcrypt';
import { loginUser } from '@/infrastructure/auth/use-cases/loginUser';
import type { LoginFormState } from '@/domain/auth/formTypes';
import { sanitizeNextPath } from '@/domain/auth/redirect';
import { applyAuthCookie } from '@/infrastructure/auth/applyAuthCookie';
import { getAuthDatabaseClient } from '@/infrastructure/auth/db';
import { isSecureCookieEnv } from '@/infrastructure/auth/sessionCookieOptions';
import { createAuthHintCookie } from '@/infrastructure/auth/authHintCookie';
import { DEFAULT_SESSION_TTL_SECONDS } from '@/infrastructure/auth/sessionCookie';

export async function loginAction(
    _prev: LoginFormState,
    formData: FormData
): Promise<LoginFormState> {
    const email = String(formData.get('email') ?? '').trim();
    const password = String(formData.get('password') ?? '');
    const next = sanitizeNextPath(formData.get('next')?.toString());

    const { db } = getAuthDatabaseClient();
    const result = await loginUser(
        { email, password },
        {
            users: new DrizzleUserRepository(db),
            sessions: new DrizzleSessionRepository(db),
            passwordVerifier: bcryptPasswordVerifier,
        },
        { secureCookie: isSecureCookieEnv() }
    );

    if (!result.ok) {
        return {
            error: { code: result.error.code, message: result.error.message },
        };
    }

    const cookieStore = await cookies();
    cookieStore.set(applyAuthCookie(result.cookie));
    cookieStore.set(
        createAuthHintCookie({
            maxAgeSeconds: DEFAULT_SESSION_TTL_SECONDS,
            secure: isSecureCookieEnv(),
        })
    );
    redirect(next);
}
