'use server';

import { cookies } from 'next/headers';
import { AUTH_SESSION_COOKIE_NAME } from '@/shared/config/cookieNames';
import type { AuthUserRecord } from '@/shared/lib/auth/types';
import { logActionError } from '@/shared/lib/logActionError';
import { applyAuthCookie } from '../lib/applyAuthCookie';
import { createExpiredAuthHintCookie } from '../lib/authHintCookie';
import { getCurrentUser } from '../lib/getCurrentUser';
import { createExpiredSessionCookie } from '../lib/sessionCookie';
import { isSecureCookieEnv } from '../lib/sessionCookieOptions';

/**
 * 헤더·게이트가 `useCurrentUser`로 부르는 현재 사용자 조회 액션. 조회가 실패하면 던지지 않고
 * null을 돌려준다(게스트로 취급). 실패 로그는 `logActionError`로 남긴다 — 세션 조회 쿼리의
 * `DrizzleQueryError` 메시지에 바인딩 파라미터(= 세션 토큰 원문)가 박혀 있어 에러를 그대로 찍으면 안 된다.
 */
export async function currentUserAction(): Promise<AuthUserRecord | null> {
    try {
        const user = await getCurrentUser();
        if (user === null) await clearStaleSessionCookie();
        return user;
    } catch (err) {
        logActionError('[currentUserAction] unexpected error', err);
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
 * (쿠키만 남은 브라우저에서 재현된다). 프록시 로그에는 307이
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
