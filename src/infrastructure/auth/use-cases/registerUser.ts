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
const EMAIL_ALREADY_EXISTS_MESSAGE = '이미 사용 중인 이메일입니다.';
const EMAIL_NOT_VERIFIED_MESSAGE =
    '이메일 인증을 완료해야 회원가입이 가능합니다.';
const INVALID_INPUT_MESSAGE = '필수 동의 항목을 확인해주세요.';

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
    if (input.agreedTermsIds.length === 0) {
        return {
            ok: false,
            error: { code: 'invalid_input', message: INVALID_INPUT_MESSAGE },
        };
    }

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
        // Existing account → keep the marker around so the user can hit
        // "register" again without re-verifying. The marker will TTL-expire on
        // its own. This intentionally does NOT delete the marker.
        return { ok: false, error: emailAlreadyExistsError() };
    }

    const now = new Date();
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

    // Insert agreements after user creation. On failure, compensate by
    // deleting the user so the registration can be retried without hitting
    // email_already_exists on the next attempt.
    try {
        await dependencies.agreements.insertMany(
            input.agreedTermsIds.map(termsId => ({
                userId: user.id,
                termsId,
                agreed: true,
                agreedAt: now,
            }))
        );
    } catch (err) {
        // Best-effort rollback — log secondary failure so degradation is observable.
        await dependencies.users.deleteUser(user.id).catch(deleteErr => {
            console.warn(
                '[registerUser] compensating delete failed — user row may be orphaned',
                deleteErr
            );
        });
        throw err;
    }

    // Registration succeeded — clear the verified marker now that it has served its purpose.
    await dependencies.emailTokens.delete(PURPOSE, email);
    return { ok: true, user };
}
