'use server';

import {
    createEmailTokenStore,
    requestEmailVerification,
} from '@y0ngha/siglens-core';
import type { RequestEmailVerificationFormState } from '@/domain/auth/formTypes';
import { buildEmailVerificationEmail } from '@/infrastructure/email/emailVerificationEmail';
import { createEmailDispatcher } from '@/infrastructure/email/resend';

const REDIS_NOT_CONFIGURED_MESSAGE =
    '서비스가 일시적으로 동작하지 않습니다. 잠시 후 다시 시도해주세요.';

export async function requestEmailVerificationAction(
    _prev: RequestEmailVerificationFormState,
    formData: FormData
): Promise<RequestEmailVerificationFormState> {
    const email = String(formData.get('email') ?? '').trim();

    const emailTokens = createEmailTokenStore();
    if (!emailTokens) {
        return {
            submitted: false,
            error: {
                code: 'redis_unavailable',
                message: REDIS_NOT_CONFIGURED_MESSAGE,
            },
        };
    }
    const emailDispatcher = createEmailDispatcher();

    // 코어가 항상 ok: true 를 반환한다 (enumeration 회피). codeIssued/emailDispatched 는
    // 운영 상황 디버깅용 필드로, UI 응답에는 영향을 주지 않는다.
    await requestEmailVerification(
        { email },
        { emailTokens, emailDispatcher },
        {
            buildMessage: code =>
                buildEmailVerificationEmail({ to: email, code }),
        }
    );

    return { submitted: true, error: null };
}
