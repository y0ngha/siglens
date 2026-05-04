import { normalizeEmail, validateEmail } from '@/domain/auth/validation';
import type { AuthUserRecord } from '@/infrastructure/db/types';
import { createAuthSession } from '@/infrastructure/auth/sessionCookie';
import { EMAIL_ALREADY_EXISTS_CODE } from '@/infrastructure/auth/use-cases/constants';
import type {
    SocialLoginUserDependencies,
    SocialLoginUserError,
    SocialLoginUserInput,
    SocialLoginUserOptions,
    SocialLoginUserResult,
} from '@/infrastructure/auth/use-cases/types';

const EMAIL_ALREADY_EXISTS_MESSAGE =
    '이미 다른 로그인 방법으로 가입된 이메일입니다.';
const INVALID_OAUTH_PROFILE_MESSAGE =
    'OAuth 프로필에서 유효한 이메일 또는 계정 정보를 찾을 수 없습니다.';

function normalizeOptionalProfileValue(
    value: string | undefined
): string | undefined {
    return value?.trim();
}

function emailAlreadyExistsError(): SocialLoginUserError {
    return {
        code: EMAIL_ALREADY_EXISTS_CODE,
        message: EMAIL_ALREADY_EXISTS_MESSAGE,
    };
}

function invalidOAuthProfileError(): SocialLoginUserError {
    return {
        code: 'invalid_oauth_profile',
        message: INVALID_OAUTH_PROFILE_MESSAGE,
    };
}

async function createSessionResult(
    user: AuthUserRecord,
    dependencies: SocialLoginUserDependencies,
    options: SocialLoginUserOptions
): Promise<Extract<SocialLoginUserResult, { ok: true }>> {
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

    return { ok: true, user, session, cookie };
}

/** Log in or provision a user from a successful OAuth provider callback. */
export async function socialLoginUser(
    input: SocialLoginUserInput,
    dependencies: SocialLoginUserDependencies,
    options: SocialLoginUserOptions = {}
): Promise<SocialLoginUserResult> {
    const providerAccountId = input.providerAccountId.trim();
    const email = normalizeEmail(input.email);
    if (providerAccountId === '' || validateEmail(email) !== null) {
        return { ok: false, error: invalidOAuthProfileError() };
    }

    const existingOAuthUser = await dependencies.users.findByOAuthAccount(
        input.provider,
        providerAccountId
    );
    if (existingOAuthUser !== null) {
        return createSessionResult(existingOAuthUser, dependencies, options);
    }

    const existingEmailUser = await dependencies.users.findByEmail(email);
    if (existingEmailUser !== null) {
        return { ok: false, error: emailAlreadyExistsError() };
    }

    const createdUser = await dependencies.users.createOAuthUser({
        email,
        provider: input.provider,
        providerAccountId,
        name: normalizeOptionalProfileValue(input.name),
        avatarUrl: normalizeOptionalProfileValue(input.avatarUrl),
        accessToken: input.accessToken,
        refreshToken: input.refreshToken,
        tokenExpiresAt: input.tokenExpiresAt,
    });
    if (createdUser !== null) {
        return createSessionResult(createdUser, dependencies, options);
    }

    const racedOAuthUser = await dependencies.users.findByOAuthAccount(
        input.provider,
        providerAccountId
    );

    return racedOAuthUser === null
        ? { ok: false, error: emailAlreadyExistsError() }
        : createSessionResult(racedOAuthUser, dependencies, options);
}
