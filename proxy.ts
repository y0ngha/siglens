import { NextResponse, type NextRequest } from 'next/server';
import { AUTH_SESSION_COOKIE_NAME } from '@y0ngha/siglens-core';

/**
 * 이미 로그인된 사용자가 /login·/signup 진입 시 / 로 보내는 역방향 가드.
 * 그 외 라우트는 모두 통과 — 비회원도 자유롭게 이용 가능.
 */
export function proxy(req: NextRequest) {
    const hasSession = !!req.cookies.get(AUTH_SESSION_COOKIE_NAME)?.value;
    if (hasSession) {
        return NextResponse.redirect(new URL('/', req.url));
    }
    return NextResponse.next();
}

export const config = {
    matcher: ['/login', '/signup'],
};
