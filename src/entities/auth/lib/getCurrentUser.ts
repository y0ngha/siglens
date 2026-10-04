import { cache } from 'react';
import { cookies } from 'next/headers';
import { AUTH_SESSION_COOKIE_NAME } from './sessionCookie';
import { DrizzleSessionRepository, DrizzleUserRepository } from '../api';
import { findUserBySessionToken } from './findUserBySessionToken';
import type { AuthUserRecord } from '@/shared/lib/auth/types';
import { getDatabaseClient } from '@/shared/db/client';

/**
 * 현재 요청의 세션 쿠키를 읽어 사용자 레코드를 반환한다. 쿠키 없음/만료/사용자 없음 시 null.
 *
 * **한 렌더 안에서는 한 번만 조회한다**(React `cache`). 세션 조회는 DB 왕복 두 번
 * (세션 → 유저)인데, 한 페이지를 그리는 동안 페이지와 그 안의 데이터 로더가 각자 이
 * 함수를 불러 같은 조회가 2~3번 돌았다 — `/c/[id]`는 페이지 + 대화 조회 + 대화 목록에서
 * 세 번, `/account`는 페이지 + 등록 프로바이더 조회에서 두 번.
 *
 * `cache`는 React 서버 렌더 안에서만 메모이즈한다. 렌더 밖(Route Handler, Server Action
 * 본문)의 호출은 지금처럼 매번 조회하므로, 세션을 만들거나 지운 직후에 다시 읽는 코드는
 * 영향받지 않는다.
 */
export const getCurrentUser = cache(
    async (): Promise<AuthUserRecord | null> => {
        const sessionToken = (await cookies()).get(
            AUTH_SESSION_COOKIE_NAME
        )?.value;
        if (!sessionToken) return null;
        const { db } = getDatabaseClient();
        return findUserBySessionToken(sessionToken, {
            users: new DrizzleUserRepository(db),
            sessions: new DrizzleSessionRepository(db),
        });
    }
);
