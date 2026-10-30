import { createExpiredSessionCookie } from './sessionCookie';
import type {
    LogoutUserDependencies,
    LogoutUserInput,
    LogoutUserOptions,
    LogoutUserResult,
} from './authUseCaseTypes';

/**
 * 저장된 세션 행을 지우고 브라우저용 만료 쿠키를 돌려준다. 세션이 이미 없어도 `ok: true`이며
 * 실제로 지웠는지는 `sessionInvalidated`로 구분한다.
 */
export async function logoutUser(
    input: LogoutUserInput,
    dependencies: LogoutUserDependencies,
    options: LogoutUserOptions = {}
): Promise<LogoutUserResult> {
    const sessionInvalidated = await dependencies.sessions.deleteSession(
        input.sessionToken
    );
    const cookie = createExpiredSessionCookie({
        name: options.cookieName,
        secure: options.secureCookie,
        sameSite: options.sameSite,
        path: options.path,
    });

    return { ok: true, sessionInvalidated, cookie };
}
