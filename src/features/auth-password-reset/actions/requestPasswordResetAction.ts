'use server';

import { DrizzleUserRepository, requestPasswordReset } from '@/entities/user';
import {
    createEmailTokenStore,
    buildPasswordResetEmail,
} from '@/entities/email-token';
import type { ForgotPasswordFormState } from '@/shared/lib/auth/formTypes';
import { normalizeEmail } from '@/shared/lib/auth/validation';
import { createEmailDispatcher } from '@/shared/email';
import { getAuthDatabaseClient } from '@/entities/session';

export async function requestPasswordResetAction(
    _prev: ForgotPasswordFormState,
    formData: FormData
): Promise<ForgotPasswordFormState> {
    try {
        const email = normalizeEmail(String(formData.get('email') ?? ''));

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
    } catch (err) {
        console.error('[requestPasswordResetAction] unexpected error:', err);
        // enumeration 회피: 에러가 발생해도 submitted:true 반환하여 이메일 존재 여부를 노출하지 않음.
        return { submitted: true };
    }
}
