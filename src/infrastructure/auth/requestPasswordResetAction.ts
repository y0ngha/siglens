'use server';

import { DrizzleUserRepository } from '@/entities/user';
import { requestPasswordReset } from '@/infrastructure/auth/use-cases/requestPasswordReset';
import {
    createEmailTokenStore,
    buildPasswordResetEmail,
} from '@/entities/email-token';
import type { ForgotPasswordFormState } from '@/domain/auth/formTypes';
import { createEmailDispatcher } from '@/shared/email';
import { getAuthDatabaseClient } from '@/infrastructure/auth/db';

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
            buildMessage: token => buildPasswordResetEmail({ email, token }),
        }
    );

    return { submitted: true };
}
