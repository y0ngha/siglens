'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
    DrizzleSessionRepository,
    DrizzleUserRepository,
    bcryptPasswordVerifier,
    loginUser,
} from '@y0ngha/siglens-core';
import type { LoginFormState } from '@/domain/auth/formTypes';
import { applyAuthCookie } from './applyAuthCookie';
import { getAuthDatabaseClient } from './db';
import { isSecureCookieEnv } from './sessionCookieOptions';
import { sanitizeNextPath } from '@/lib/authRoutes';

export async function loginAction(
    _prev: LoginFormState,
    formData: FormData
): Promise<LoginFormState> {
    const email = String(formData.get('email') ?? '');
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

    (await cookies()).set(applyAuthCookie(result.cookie));
    redirect(next);
}
