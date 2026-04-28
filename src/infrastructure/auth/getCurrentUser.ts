import { cookies } from 'next/headers';
import {
    AUTH_SESSION_COOKIE_NAME,
    DrizzleSessionRepository,
    DrizzleUserRepository,
    findUserBySessionToken,
} from '@y0ngha/siglens-core';
import type { AuthUserRecord } from '@y0ngha/siglens-core';
import { getAuthDatabaseClient } from './db';

/**
 * 현재 요청의 세션 쿠키를 읽어 사용자 레코드를 반환한다.
 * 쿠키 없음/만료/사용자 없음 시 null.
 */
export async function getCurrentUser(): Promise<AuthUserRecord | null> {
    const sessionToken = (await cookies()).get(AUTH_SESSION_COOKIE_NAME)?.value;
    if (!sessionToken) return null;
    const { db } = getAuthDatabaseClient();
    return findUserBySessionToken(sessionToken, {
        users: new DrizzleUserRepository(db),
        sessions: new DrizzleSessionRepository(db),
    });
}
