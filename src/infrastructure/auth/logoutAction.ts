'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { DrizzleSessionRepository } from '@/infrastructure/db/sessionRepository';
import { AUTH_SESSION_COOKIE_NAME } from '@/infrastructure/auth/sessionCookie';
import { logoutUser } from '@/infrastructure/auth/use-cases/logoutUser';
import { applyAuthCookie } from '@/infrastructure/auth/applyAuthCookie';
import { getAuthDatabaseClient } from '@/infrastructure/auth/db';
import { isSecureCookieEnv } from '@/infrastructure/auth/sessionCookieOptions';
import { createExpiredAuthHintCookie } from '@/infrastructure/auth/authHintCookie';

export async function logoutAction(): Promise<void> {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(AUTH_SESSION_COOKIE_NAME)?.value;
    if (sessionToken) {
        const { db } = getAuthDatabaseClient();
        const result = await logoutUser(
            { sessionToken },
            { sessions: new DrizzleSessionRepository(db) },
            { secureCookie: isSecureCookieEnv() }
        );
        cookieStore.set(applyAuthCookie(result.cookie));
        cookieStore.set(createExpiredAuthHintCookie({ secure: isSecureCookieEnv() }));
    }
    redirect('/');
}
