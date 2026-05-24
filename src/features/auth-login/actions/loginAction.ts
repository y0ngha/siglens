'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { DrizzleSessionRepository } from '@/entities/session';
import { DrizzleUserRepository } from '@/entities/user';
import { bcryptPasswordVerifier } from '@/entities/session/lib/bcrypt';
import { loginUser } from '@/entities/user/lib/loginUser';
import type { LoginFormState } from '@/shared/lib/auth/formTypes';
import { sanitizeNextPath } from '@/shared/lib/auth/redirect';
import { applyAuthCookie } from '@/entities/session/lib/applyAuthCookie';
import { getAuthDatabaseClient } from '@/entities/session/lib/db';
import { isSecureCookieEnv } from '@/entities/session/lib/sessionCookieOptions';
import { createAuthHintCookie } from '@/entities/session/lib/authHintCookie';
import { DEFAULT_SESSION_TTL_SECONDS } from '@/entities/session/lib/sessionCookie';

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
