'use server';

import {
    DrizzleUserRepository,
    createEmailTokenStore,
    requestPasswordReset,
} from '@y0ngha/siglens-core';
import type { ForgotPasswordFormState } from '@/domain/auth/formTypes';
import { buildPasswordResetEmail } from '@/infrastructure/email/passwordResetEmail';
import { createEmailDispatcher } from '@/infrastructure/email/resend';
import { getAuthDatabaseClient } from './db';

export async function requestPasswordResetAction(
    _prev: ForgotPasswordFormState,
    formData: FormData
): Promise<ForgotPasswordFormState> {
    const email = String(formData.get('email') ?? '').trim();

    const emailTokens = createEmailTokenStore();
    if (!emailTokens) {
        // Redis 미설정은 운영 환경 설정 오류. enumeration 회피를 위해 사용자에게는
        // 동일한 success 응답을 돌려주고, 로그만 남긴다.
        console.warn('[auth] Email token store not configured');
        return { submitted: true };
    }

    const { db } = getAuthDatabaseClient();
    const repo = new DrizzleUserRepository(db);
    const emailDispatcher = createEmailDispatcher();

    // 코어가 토큰 발급/저장/dispatcher 호출까지 모두 처리한다. 결과는 항상 ok: true이며
    // (enumeration 회피) tokenIssued / emailDispatched 는 디버깅 정보일 뿐이다.
    await requestPasswordReset(
        { email },
        { users: repo, emailTokens, emailDispatcher },
        {
            buildMessage: token =>
                buildPasswordResetEmail({ to: email, email, token }),
        }
    );

    return { submitted: true };
}
