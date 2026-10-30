import { normalizeEmail, validateEmail } from '@/shared/lib/auth/validation';
import { generateNumericCode, hashEmailToken } from './tokenUtils';
import {
    EMAIL_VERIFICATION_CODE_LENGTH,
    EMAIL_VERIFICATION_PENDING_TTL_SECONDS,
} from './authUseCaseConstants';
import type {
    RequestEmailVerificationDependencies,
    RequestEmailVerificationInput,
    RequestEmailVerificationOptions,
    RequestEmailVerificationResult,
} from './authUseCaseTypes';

const PURPOSE = 'email_verification' as const;

/**
 * 숫자 이메일 인증 코드를 발급해 해당 주소로 보낸다. 코드는 해시만 저장한다.
 *
 * 형식이 잘못된 이메일은 오류 대신 `ok: true`(`codeIssued: false`)를 돌려준다. 발송 실패는
 * 던지지 않고 `emailDispatched: false`로 알린다.
 */
export async function requestEmailVerification(
    input: RequestEmailVerificationInput,
    dependencies: RequestEmailVerificationDependencies,
    options: RequestEmailVerificationOptions
): Promise<RequestEmailVerificationResult> {
    const email = normalizeEmail(input.email);
    const emailError = validateEmail(email);

    if (emailError !== null) {
        return { ok: true, codeIssued: false, emailDispatched: false };
    }

    const code = generateNumericCode(EMAIL_VERIFICATION_CODE_LENGTH);
    const tokenHash = hashEmailToken(code);

    await dependencies.emailTokens.set(
        PURPOSE,
        email,
        { status: 'pending', tokenHash },
        EMAIL_VERIFICATION_PENDING_TTL_SECONDS
    );

    const message = options.buildMessage(code);
    const emailDispatched = await dependencies.emailDispatcher
        .sendEmail(message)
        .catch((error: unknown) => {
            console.warn(
                '[requestEmailVerification] emailDispatcher.sendEmail failed',
                error
            );
            return false;
        });

    return { ok: true, codeIssued: true, emailDispatched };
}
