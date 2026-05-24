import { normalizeEmail } from '@/domain/auth/validation';
import type { AuthUserRecord, EmailAuthUserRecord } from '@/shared/db/types';
import { createAuthSession } from '@/infrastructure/auth/sessionCookie';
import type {
    LoginUserDependencies,
    LoginUserError,
    LoginUserInput,
    LoginUserOptions,
    LoginUserResult,
} from '@/infrastructure/auth/use-cases/types';

const INVALID_CREDENTIALS_MESSAGE = '이메일 또는 비밀번호가 올바르지 않습니다.';

function invalidCredentialsError(): LoginUserError {
    return {
        code: 'invalid_credentials',
        message: INVALID_CREDENTIALS_MESSAGE,
    };
}

function omitPasswordHash(user: EmailAuthUserRecord): AuthUserRecord {
    const { passwordHash: _passwordHash, ...safeUser } = user;
    return safeUser;
}

/** Log in a user with email and password. */
export async function loginUser(
    input: LoginUserInput,
    dependencies: LoginUserDependencies,
    options: LoginUserOptions = {}
): Promise<LoginUserResult> {
    const email = normalizeEmail(input.email);
    const user = await dependencies.users.findEmailAuthUserByEmail(email);

    if (user === null || user.passwordHash === null) {
        return { ok: false, error: invalidCredentialsError() };
    }

    const passwordMatches = await dependencies.passwordVerifier.verifyPassword(
        input.password,
        user.passwordHash
    );

    if (!passwordMatches) {
        return { ok: false, error: invalidCredentialsError() };
    }

    const now = options.now ?? new Date();
    const { session, cookie } = await createAuthSession({
        userId: user.id,
        sessions: dependencies.sessions,
        now,
        sessionTtlSeconds: options.sessionTtlSeconds,
        cookieName: options.cookieName,
        secureCookie: options.secureCookie,
        sameSite: options.sameSite,
        path: options.path,
    });
    const safeUser = omitPasswordHash(user);

    return { ok: true, user: safeUser, session, cookie };
}
