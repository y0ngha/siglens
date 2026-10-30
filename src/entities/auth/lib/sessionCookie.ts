import { AUTH_SESSION_COOKIE_NAME } from '@/shared/config/cookieNames';
import type { AuthSessionRecord, SessionRepository } from '@/shared/db/types';
import type { AuthSessionCookie } from '@/shared/lib/auth/types';

/** 세션 수명(초) 기본값 — 30일. DB 행의 `expiresAt`과 쿠키 `maxAge`가 모두 이 값에서 나온다. */
export const DEFAULT_SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

/** 세션 쿠키 `Path` 기본값 — 사이트 전체에 실린다. */
export const DEFAULT_AUTH_COOKIE_PATH = '/';

/** 세션 쿠키 `SameSite` 기본값 — 외부 사이트에서의 top-level GET 이동(OAuth 콜백 복귀)에는 실리고 cross-site 하위 요청에는 실리지 않는다. */
export const DEFAULT_AUTH_COOKIE_SAME_SITE = 'lax';

const EXPIRED_COOKIE_DATE = new Date('1970-01-01T00:00:00.000Z');
const MILLISECONDS_PER_SECOND = 1000;

function addSeconds(date: Date, seconds: number): Date {
    return new Date(date.getTime() + seconds * MILLISECONDS_PER_SECOND);
}

/** @internal 토큰과 만료 정보로 활성 HttpOnly 세션 쿠키를 만든다. `secure`를 생략하면 true(fail-closed)다. */
export function createSessionCookie(params: {
    token: string;
    expires: Date;
    maxAgeSeconds: number;
    name?: string;
    secure?: boolean;
    sameSite?: AuthSessionCookie['sameSite'];
    path?: string;
}): AuthSessionCookie {
    return {
        name: params.name ?? AUTH_SESSION_COOKIE_NAME,
        value: params.token,
        httpOnly: true,
        secure: params.secure ?? true,
        sameSite: params.sameSite ?? DEFAULT_AUTH_COOKIE_SAME_SITE,
        path: params.path ?? DEFAULT_AUTH_COOKIE_PATH,
        expires: params.expires,
        maxAgeSeconds: params.maxAgeSeconds,
    };
}

/** @internal 브라우저의 세션 쿠키를 지우는 `maxAge` 0·epoch 만료 쿠키(로그아웃·탈퇴·죽은 세션 정리). */
export function createExpiredSessionCookie(params?: {
    name?: string;
    secure?: boolean;
    sameSite?: AuthSessionCookie['sameSite'];
    path?: string;
}): AuthSessionCookie {
    return createSessionCookie({
        token: '',
        expires: EXPIRED_COOKIE_DATE,
        maxAgeSeconds: 0,
        name: params?.name,
        secure: params?.secure,
        sameSite: params?.sameSite,
        path: params?.path,
    });
}

/** {@link createAuthSession}의 결과: 저장된 세션 행과 그 행의 id를 값으로 담은 응답 쿠키. */
interface CreateAuthSessionResult {
    session: AuthSessionRecord;
    cookie: AuthSessionCookie;
}

/**
 * @internal 로그인 계열 유스케이스가 공유하는 세션 행 + 쿠키 생성. 세션 id는 DB가 만드는
 * 새 uuid라 로그인마다 새 토큰이 발급된다(이전 쿠키 값을 재사용하지 않는다).
 */
export async function createAuthSession(params: {
    userId: string;
    sessions: SessionRepository;
    now: Date;
    sessionTtlSeconds?: number;
    cookieName?: string;
    secureCookie?: boolean;
    sameSite?: AuthSessionCookie['sameSite'];
    path?: string;
}): Promise<CreateAuthSessionResult> {
    const sessionTtlSeconds =
        params.sessionTtlSeconds ?? DEFAULT_SESSION_TTL_SECONDS;
    const expiresAt = addSeconds(params.now, sessionTtlSeconds);
    const session = await params.sessions.createSession({
        userId: params.userId,
        expiresAt,
    });
    const cookie = createSessionCookie({
        token: session.id,
        expires: session.expiresAt,
        maxAgeSeconds: sessionTtlSeconds,
        name: params.cookieName,
        secure: params.secureCookie,
        sameSite: params.sameSite,
        path: params.path,
    });

    return { session, cookie };
}
