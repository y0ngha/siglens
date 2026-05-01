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

    // 코어 위임 — 토큰 발급·이메일 발송까지 처리, ok: true 고정 (enumeration 회피), Server Action 블로킹 의도됨.
    await requestPasswordReset(
        { email },
        { users: repo, emailTokens, emailDispatcher },
        {
            buildMessage: token =>
                buildPasswordResetEmail({ email, token }),
        }
    );

    return { submitted: true };
}
