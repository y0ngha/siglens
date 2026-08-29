'use server';

import {
    requestEmailVerification,
    AUTH_SERVICE_UNAVAILABLE_MESSAGE,
} from '@/entities/auth';
import {
    createEmailTokenStore,
    buildEmailVerificationEmail,
} from '@/entities/email-token';
import type { RequestEmailVerificationFormState } from '@/shared/lib/auth/formTypes';
import { createEmailDispatcher } from '@/shared/email';
import { normalizeEmail } from '@/shared/lib/auth/validation';
import { getTranslations } from 'next-intl/server';
import { resolveRequestLocale } from '@/shared/i18n/requestLocale';

export async function requestEmailVerificationAction(
    _prev: RequestEmailVerificationFormState,
    formData: FormData
): Promise<RequestEmailVerificationFormState> {
    // 상태의 `message`가 그대로 화면에 뿌려지므로 요청 로케일로 만든다.
    const tAuth = await getTranslations('entities.auth.error');
    try {
        const email = normalizeEmail(String(formData.get('email') ?? ''));

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
