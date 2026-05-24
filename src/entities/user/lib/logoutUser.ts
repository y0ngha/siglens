import { createExpiredSessionCookie } from '@/entities/session/lib/sessionCookie';
import type {
    LogoutUserDependencies,
    LogoutUserInput,
    LogoutUserOptions,
    LogoutUserResult,
} from './authUseCaseTypes';

/** Log out a user by invalidating their persisted session token. */
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
