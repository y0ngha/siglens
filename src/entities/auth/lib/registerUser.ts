import type { RegisterUserError } from '@/shared/lib/auth/types';
import {
    normalizeEmail,
    validateEmail,
    validatePassword,
} from '@/shared/lib/auth/validation';
import {
    EMAIL_ALREADY_EXISTS_CODE,
    EMAIL_NOT_VERIFIED_CODE,
} from './authUseCaseConstants';
import type {
    RegisterUserDependencies,
    RegisterUserInput,
    RegisterUserResult,
} from './authUseCaseTypes';

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

/**
 * 이메일·비밀번호로 가입시키고 약관 동의를 기록한다. 이메일 인증 마커(`verified`)가 있어야 한다.
 *
 * 동의 기록이 실패하면 방금 만든 사용자를 지워(보상) 같은 이메일로 재시도할 수 있게 하고
 * 원래 오류를 다시 던진다. 가입이 끝나면 인증 마커를 지운다.
 */
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
        // 이미 있는 계정이면 마커를 남긴다 — 사용자가 재인증 없이 다시 "가입"을 눌러볼 수
        // 있고, 마커는 TTL로 알아서 만료된다. 의도적으로 마커를 지우지 않는다.
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

    // 동의 기록은 사용자 생성 뒤에 넣는다. 실패하면 사용자를 지워 보상해, 다음 시도가
    // email_already_exists에 막히지 않고 가입을 재시도할 수 있게 한다.
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
        // 최선 노력 롤백 — 보상 실패도 로그로 남겨 저하를 관측할 수 있게 한다.
        await dependencies.users.deleteUser(user.id).catch(deleteErr => {
            console.warn(
                '[registerUser] compensating delete failed — user row may be orphaned',
                deleteErr
            );
        });
        throw err;
    }

    // 가입이 끝났으니 역할을 다한 인증 마커를 지운다.
    await dependencies.emailTokens.delete(PURPOSE, email);
    return { ok: true, user };
}
