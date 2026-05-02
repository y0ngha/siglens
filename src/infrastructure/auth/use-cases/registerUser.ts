import {
    normalizeEmail,
    validateEmail,
    validatePassword,
} from '@/domain/auth/validation';
import {
    EMAIL_ALREADY_EXISTS_CODE,
    EMAIL_NOT_VERIFIED_CODE,
} from '@/infrastructure/auth/use-cases/constants';
import type {
    RegisterUserDependencies,
    RegisterUserError,
    RegisterUserInput,
    RegisterUserResult,
} from '@/infrastructure/auth/use-cases/types';

const PURPOSE = 'email_verification' as const;
const EMAIL_ALREADY_EXISTS_MESSAGE = 'Email is already registered';
const EMAIL_NOT_VERIFIED_MESSAGE =
    'Email must be verified before registration. Complete the verification flow first.';

function emailAlreadyExistsError(): RegisterUserError {
    return {
        code: EMAIL_ALREADY_EXISTS_CODE,
        field: 'email',
        message: EMAIL_ALREADY_EXISTS_MESSAGE,
    };
}

function emailNotVerifiedError(): RegisterUserError {
    return {
        code: EMAIL_NOT_VERIFIED_CODE,
        field: 'email',
        message: EMAIL_NOT_VERIFIED_MESSAGE,
    };
}

/** Register a new user with email and password. */
export async function registerUser(
    input: RegisterUserInput,
    dependencies: RegisterUserDependencies
): Promise<RegisterUserResult> {
    const email = normalizeEmail(input.email);
    const emailError = validateEmail(email);
    if (emailError !== null) return { ok: false, error: emailError };

    const passwordError = validatePassword(input.password);
    if (passwordError !== null) return { ok: false, error: passwordError };

    const verification = await dependencies.emailTokens.get(PURPOSE, email);
    if (verification === null || verification.status !== 'verified') {
        return { ok: false, error: emailNotVerifiedError() };
    }

    const existingUser = await dependencies.users.findByEmail(email);
    if (existingUser !== null) {
        return { ok: false, error: emailAlreadyExistsError() };
    }

    const passwordHash = await dependencies.passwordHasher.hashPassword(
        input.password
    );
    const user = await dependencies.users.createEmailUser({
        email,
        passwordHash,
        name: input.name?.trim() || null,
        avatarUrl: input.avatarUrl?.trim() || null,
        emailVerified: true,
    });

    if (user === null) {
        return { ok: false, error: emailAlreadyExistsError() };
    }

    await dependencies.emailTokens.delete(PURPOSE, email);
    return { ok: true, user };
}
