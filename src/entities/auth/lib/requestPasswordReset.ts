import { normalizeEmail, validateEmail } from '@/shared/lib/auth/validation';
import { generateUrlSafeToken, hashEmailToken } from './tokenUtils';
import {
    PASSWORD_RESET_TOKEN_BYTE_LENGTH,
    PASSWORD_RESET_TTL_SECONDS,
} from './authUseCaseConstants';
import type {
    RequestPasswordResetDependencies,
    RequestPasswordResetInput,
    RequestPasswordResetOptions,
    RequestPasswordResetResult,
} from './authUseCaseTypes';

const PURPOSE = 'password_reset' as const;

/**
 * 1회용 비밀번호 재설정 토큰을 발급해 메일로 보낸다. 토큰은 해시만 저장한다.
 *
 * 잘못된 이메일·없는 계정·비밀번호 없는(OAuth 전용) 계정은 모두 `ok: true`
 * (`tokenIssued: false`)로 같게 응답해 계정 존재 여부가 새지 않게 한다. 발송 실패는
 * 던지지 않고 `emailDispatched: false`로 알린다.
 */
export async function requestPasswordReset(
    input: RequestPasswordResetInput,
    dependencies: RequestPasswordResetDependencies,
    options: RequestPasswordResetOptions
): Promise<RequestPasswordResetResult> {
    const email = normalizeEmail(input.email);
    const emailError = validateEmail(email);

    if (emailError !== null) {
        return { ok: true, tokenIssued: false, emailDispatched: false };
    }

    const user = await dependencies.users.findEmailAuthUserByEmail(email);

    if (user === null || user.passwordHash === null) {
        return { ok: true, tokenIssued: false, emailDispatched: false };
    }

    const rawToken = generateUrlSafeToken(PASSWORD_RESET_TOKEN_BYTE_LENGTH);
    const tokenHash = hashEmailToken(rawToken);

    await dependencies.emailTokens.set(
        PURPOSE,
        email,
        { status: 'pending', tokenHash },
        PASSWORD_RESET_TTL_SECONDS
    );

    const message = options.buildMessage(rawToken);
    const emailDispatched = await dependencies.emailDispatcher
        .sendEmail(message)
        .catch((error: unknown) => {
            console.warn(
                '[requestPasswordReset] emailDispatcher.sendEmail failed',
                error
            );
            return false;
        });

    return { ok: true, tokenIssued: true, emailDispatched };
}
