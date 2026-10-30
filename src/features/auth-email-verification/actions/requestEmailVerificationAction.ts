'use server';

import { requestEmailVerification } from '@/entities/auth/lib/requestEmailVerification';
import { AUTH_SERVICE_UNAVAILABLE_MESSAGE } from '@/entities/auth/lib/errorMessages';
import { createEmailTokenStore } from '@/entities/email-token/api';
import { buildEmailVerificationEmail } from '@/entities/email-token/templates/emailVerificationEmail';
import type { RequestEmailVerificationFormState } from '@/shared/lib/auth/formTypes';
import { createEmailDispatcher } from '@/shared/email/dispatcher';
import { INVALID_EMAIL_CODE } from '@/shared/lib/auth/constants';
import { normalizeEmail, validateEmail } from '@/shared/lib/auth/validation';
import { getTranslations } from 'next-intl/server';
import { resolveRequestLocale } from '@/shared/i18n/requestLocale';

/**
 * 가입 1단계: 입력한 주소로 이메일 인증 코드를 발급해 보낸다.
 *
 * 형식이 틀린 주소는 `invalid_email`로 돌려보낸다 — 코드를 보낼 수 없는 주소에
 * `submitted: true`를 주면 화면이 "코드를 보냈다"며 오지 않을 코드를 기다리게 한다.
 * 형식 검사는 계정 존재 여부를 드러내지 않으므로 열거 방지와 무관하다.
 */
export async function requestEmailVerificationAction(
    _prev: RequestEmailVerificationFormState,
    formData: FormData
): Promise<RequestEmailVerificationFormState> {
    // 상태의 `message`가 그대로 화면에 뿌려지므로 요청 로케일로 만든다.
    const tAuth = await getTranslations('entities.auth.error');
    try {
        const email = normalizeEmail(String(formData.get('email') ?? ''));
        const emailError = validateEmail(email);
        if (emailError !== null) {
            return {
                submitted: false,
                error: {
                    code: INVALID_EMAIL_CODE,
                    message: emailError.message,
                },
            };
        }

        const emailTokens = createEmailTokenStore();
        if (!emailTokens) {
            return {
                submitted: false,
                error: {
                    code: 'redis_unavailable',
                    message: AUTH_SERVICE_UNAVAILABLE_MESSAGE,
                },
            };
        }
        const emailDispatcher = createEmailDispatcher();
        // 인증 메일은 발송 시점 로케일로 굳는다 — 수신자가 나중에 언어를
        // 바꿔도 이미 보낸 메일은 다시 쓰이지 않는다.
        const locale = await resolveRequestLocale();
        const tEmail = await getTranslations({
            locale,
            namespace: 'entities.email-token.email',
        });

        // ok: true 고정 (enumeration 회피); codeIssued/emailDispatched 는 운영 디버깅용 필드.
        await requestEmailVerification(
            { email },
            { emailTokens, emailDispatcher },
            {
                buildMessage: code =>
                    buildEmailVerificationEmail({
                        to: email,
                        code,
                        locale,
                        t: tEmail,
                    }),
            }
        );

        return { submitted: true, error: null };
    } catch (err) {
        console.error(
            '[requestEmailVerificationAction] unexpected error:',
            err
        );
        return {
            submitted: false,
            error: {
                code: 'unexpected',
                message: tAuth('verificationEmailFailed'),
            },
        };
    }
}
