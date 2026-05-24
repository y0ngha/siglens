'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { DrizzleSessionRepository } from '@/entities/session';
import { AUTH_SESSION_COOKIE_NAME } from '@/entities/session/lib/sessionCookie';
import { logoutUser } from '@/entities/user/lib/logoutUser';
import { applyAuthCookie } from '@/entities/session/lib/applyAuthCookie';
import { getAuthDatabaseClient } from '@/entities/session/lib/db';
import { isSecureCookieEnv } from '@/entities/session/lib/sessionCookieOptions';
import { createExpiredAuthHintCookie } from '@/entities/session/lib/authHintCookie';

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
