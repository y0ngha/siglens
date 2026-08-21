'use server';

import { localeRedirect } from '@/shared/i18n/localeRedirect';
import { cookies } from 'next/headers';
import {
    AUTH_SESSION_COOKIE_NAME,
    applyAuthCookie,
    isSecureCookieEnv,
    createExpiredAuthHintCookie,
    logoutUser,
} from '@/entities/auth';
import { DrizzleSessionRepository } from '@/entities/auth/api';
import { getAuthDatabaseClient } from '@/entities/auth/lib/db';

export async function logoutAction(): Promise<void> {
    try {
        const secure = isSecureCookieEnv();
        const cookieStore = await cookies();
        const sessionToken = cookieStore.get(AUTH_SESSION_COOKIE_NAME)?.value;
        if (sessionToken) {
            const { db } = getAuthDatabaseClient();
            const result = await logoutUser(
                { sessionToken },
                { sessions: new DrizzleSessionRepository(db) },
                { secureCookie: secure }
            );
            cookieStore.set(applyAuthCookie(result.cookie));
            cookieStore.set(createExpiredAuthHintCookie({ secure }));
        }
        return localeRedirect('/');
    } catch (err) {
        if (err instanceof Error && err.message.startsWith('NEXT_REDIRECT'))
            throw err;
        console.error('[logoutAction] unexpected error:', err);
        return localeRedirect('/');
    }
}
