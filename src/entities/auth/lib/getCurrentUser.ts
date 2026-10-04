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
 * `cache`는 **진행 중인 Flight 렌더 안에서만** 메모이즈한다. 근거는 Next에 들어 있는 React
 * 소스다: `cache()`는 `dispatcher.getCacheForType()`으로 캐시를 얻는데, 그 함수는
 * `resolveRequest()`가 현재 Flight 요청을 돌려줄 때만 그 요청의 캐시를 쓰고 없으면 호출마다
 * 새 `Map`을 만든다(`next/dist/compiled/react-server-dom-turbopack/cjs/
 * react-server-dom-turbopack-server.node.production.js`의 `getCacheForType`·`resolveRequest`,
 * Next 16.3.6 기준). Route Handler와 Server Action 본문은 Flight 요청 밖에서 실행되므로
 * 지금처럼 매번 조회하고, 액션 뒤의 재렌더는 새 Flight 요청이라 캐시가 따로다. 그래서
 * 세션을 만들거나 지운 직후에 다시 읽는 코드(`logoutAction` 등)는 영향받지 않는다 —
 * 로그아웃·탈퇴 뒤 화면 상태는 E2E(`account-logout`·`account-delete`)가 본다.
 * Next나 React를 올리면 위 두 함수가 그대로인지 다시 확인한다.
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
