'use server';

import { requestPasswordReset } from '@/entities/auth';
import { DrizzleUserRepository } from '@/entities/auth/api';
import {
    createEmailTokenStore,
    buildPasswordResetEmail,
} from '@/entities/email-token';
import type { ForgotPasswordFormState } from '@/shared/lib/auth/formTypes';
import { normalizeEmail } from '@/shared/lib/auth/validation';
import { createEmailDispatcher } from '@/shared/email';
import { getAuthDatabaseClient } from '@/entities/auth/lib/db';

/** 형식 검사만 한다 — 도메인 존재 확인이 아니다. */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function requestPasswordResetAction(
    _prev: ForgotPasswordFormState,
    formData: FormData
): Promise<ForgotPasswordFormState> {
    try {
        const email = normalizeEmail(String(formData.get('email') ?? ''));
        // 형식만 본다 — 계정 존재 여부는 아래에서 여전히 숨긴다.
        if (!EMAIL_SHAPE.test(email)) {
            return { submitted: false, error: '이메일 주소를 확인해 주세요.' };
        }

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
