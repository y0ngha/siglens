'use server';

import { cookies, headers } from 'next/headers';
import { isAiHost } from '@/shared/config/aiHost';
import {
    AUTH_SESSION_COOKIE_NAME,
    MAIN_SESSION_HINT_COOKIE_NAME,
} from '@/shared/config/cookieNames';
import type { AuthUserRecord } from '@/shared/lib/auth/types';
import { logActionError } from '@/shared/lib/logActionError';
import { applyAuthCookie } from '../lib/applyAuthCookie';
import { createExpiredAuthHintCookie } from '../lib/authHintCookie';
import {
    createExpiredMainSessionHintCookie,
    createMainSessionHintCookie,
} from '../lib/mainSessionHintCookie';
import { getCurrentUser } from '../server/getCurrentUser';
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
        await syncMainSessionHintSafely(user !== null);
        return user;
    } catch (err) {
        logActionError('[currentUserAction] unexpected error', err);
        return null;
    }
}

/**
 * 흔적 동기화는 참고용 부가 작업이다. `headers()`나 `cookies().set()`이 던져도 이미 확인된
 * 사용자를 null(게스트)로 돌려 헤더를 로그아웃 상태로 그리면 안 되므로, 실패는 기록만 하고 삼킨다.
 */
async function syncMainSessionHintSafely(signedIn: boolean): Promise<void> {
    try {
        await syncMainSessionHint(signedIn);
    } catch (err) {
        logActionError(
            '[currentUserAction] main session hint sync failed',
            err
        );
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

/**
 * 메인 호스트의 로그인 흔적(`siglens_signed_in`)을 조회 결과에 맞춘다.
 *
 * - 사용자 있음 + 흔적 없음: 심는다. 배포 전에 로그인한 세션은 로그인 시점에 흔적을 못 받았으므로
 *   그다음 메인 호스트 페이지 조회(헤더가 이 액션을 부른다)에서 따라잡는다. 세션 수명이 30일
 *   고정이라 늦어도 30일 안에 모두 수렴한다.
 * - 사용자 없음(조회 성공) + 흔적 있음: 지운다 — 죽은 세션의 흔적이 ai 호스트에서 헛된 왕복을 만들지 않게.
 * - 그 밖: 아무것도 쓰지 않는다(평범한 익명 방문자에게 `Set-Cookie`를 달지 않는다).
 *
 * ai 호스트에서는 아무것도 하지 않는다: 이 쿠키는 메인 호스트 세션의 흔적이고, ai 호스트의 세션은
 * 별개다. 조회가 실패한 경우(`currentUserAction`의 `catch`)에는 부르지 않는다.
 */
async function syncMainSessionHint(signedIn: boolean): Promise<void> {
    if (isAiHost((await headers()).get('host'))) return;
    const store = await cookies();
    const present = store.get(MAIN_SESSION_HINT_COOKIE_NAME)?.value === '1';
    if (signedIn === present) return;
    const secure = isSecureCookieEnv();
    const descriptor = signedIn
        ? createMainSessionHintCookie({ secure })
        : createExpiredMainSessionHintCookie({ secure });
    if (descriptor) store.set(descriptor);
}
