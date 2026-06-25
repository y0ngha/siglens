'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
    AUTH_SESSION_COOKIE_NAME,
    applyAuthCookie,
    isSecureCookieEnv,
    createExpiredAuthHintCookie,
} from '@/entities/auth';
import { DrizzleSessionRepository } from '@/entities/auth/api';
import { getAuthDatabaseClient } from '@/entities/auth/lib/db';
import { logoutUser } from '@/entities/auth';

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
        redirect('/');
    } catch (err) {
        if (err instanceof Error && err.message.startsWith('NEXT_REDIRECT'))
            throw err;
        console.error('[logoutAction] unexpected error:', err);
        redirect('/');
    }
}
