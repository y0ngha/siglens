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
    // enumeration 회피: Redis 미설정·미가입 이메일을 구분할 수 없도록 항상 submitted:true 반환.
    if (!emailTokens) {
        return { submitted: true };
    }

    const { db } = getAuthDatabaseClient();
    const repo = new DrizzleUserRepository(db);
    const emailDispatcher = createEmailDispatcher();

    // 코어가 토큰 발급/저장/이메일 발송까지 모두 처리하며 이메일 에러를 내부에서 스왈로우한다.
    // 결과는 항상 ok: true (enumeration 회피). Server Action 블로킹은 의도된 설계 —
    // waitUntil fire-and-forget 대신 코어 위임으로 타임아웃 없이 완료까지 대기한다.
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
