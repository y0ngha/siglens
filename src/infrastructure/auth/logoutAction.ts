'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
    AUTH_SESSION_COOKIE_NAME,
    DrizzleSessionRepository,
    logoutUser,
} from '@y0ngha/siglens-core';
import { applyAuthCookie } from './applyAuthCookie';
import { getAuthDatabaseClient } from './db';
import { isSecureCookieEnv } from './sessionCookieOptions';

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
    }
    redirect('/');
}
