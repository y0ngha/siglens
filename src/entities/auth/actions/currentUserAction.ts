'use server';

import { cookies } from 'next/headers';
import type { AuthUserRecord } from '@/shared/lib/auth/types';
import { applyAuthCookie } from '../lib/applyAuthCookie';
import { createExpiredAuthHintCookie } from '../lib/authHintCookie';
import { getCurrentUser } from '../lib/getCurrentUser';
import {
    AUTH_SESSION_COOKIE_NAME,
    createExpiredSessionCookie,
} from '../lib/sessionCookie';
import { isSecureCookieEnv } from '../lib/sessionCookieOptions';

export async function currentUserAction(): Promise<AuthUserRecord | null> {
    try {
        const user = await getCurrentUser();
        if (user === null) await clearStaleSessionCookie();
        return user;
    } catch (err) {
        console.error('[currentUserAction] unexpected error:', err);
        return null;
    }
}

/**
 * 세션 쿠키는 있는데 DB가 그 세션을 모르면(만료·다른 기기에서 로그아웃·DB 교체)
 * 쿠키를 지운다.
 *
 * 프록시의 역방향 가드는 엣지라 DB를 못 보고 **쿠키 존재만으로** `/login`·`/signup`을
 * `/`로 돌려보낸다. 그런데 헤더는 이 액션의 `null`을 받아 게스트 CTA를 그린다 —
 * 로그인 버튼을 눌러도 홈으로 튕기기만 하고 로그인 화면에 영영 못 들어간다
 * (2026-09-13 개발 서버에서 재현: 쿠키만 남은 브라우저). 프록시 로그에는 307이
 * 찍히지 않아 서버 쪽에선 요청 자체가 없어 보인다.
 *
 * DB 조회가 **실패**한 경우(위 `catch`)엔 지우지 않는다 — 일시 장애로 멀쩡한
 * 세션을 로그아웃시키면 안 된다. 여기 오는 건 조회가 성공해 "없음"이 확정된 때뿐이다.
 */
async function clearStaleSessionCookie(): Promise<void> {
    const store = await cookies();
    if (!store.get(AUTH_SESSION_COOKIE_NAME)?.value) return;
    const secure = isSecureCookieEnv();
    store.set(applyAuthCookie(createExpiredSessionCookie({ secure })));
    store.set(createExpiredAuthHintCookie({ secure }));
}
