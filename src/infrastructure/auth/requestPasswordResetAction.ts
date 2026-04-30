'use server';

import { DrizzleUserRepository } from '@y0ngha/siglens-core';
import type { ForgotPasswordFormState } from '@/domain/auth/formTypes';
import { buildPasswordResetEmail } from '@/infrastructure/email/passwordResetEmail';
import { createEmailDispatcher } from '@/infrastructure/email/resend';
// TODO(siglens-core#55): replace with real exports once the new core ships.
import {
    createEmailTokenStore,
    requestPasswordResetV2,
} from '@/domain/auth/coreStubs';
import { getAuthDatabaseClient } from './db';

export async function requestPasswordResetAction(
    _prev: ForgotPasswordFormState,
    formData: FormData
): Promise<ForgotPasswordFormState> {
    const email = String(formData.get('email') ?? '').trim();

    const { db } = getAuthDatabaseClient();
    const repo = new DrizzleUserRepository(db);
    const emailTokens = createEmailTokenStore();
    const emailDispatcher = createEmailDispatcher();

    // 코어가 토큰 발급 + Redis 저장 + dispatcher.sendEmail까지 처리한다.
    // consumer는 buildMessage 콜백에서 to/subject/html/text만 채워 넘긴다.
    await requestPasswordResetV2(
        { email },
        { users: repo, emailTokens, emailDispatcher },
        {
            buildMessage: token =>
                buildPasswordResetEmail({
                    to: email,
                    token,
                    email,
                }),
        }
    );

    // enumeration 회피 — 코어 결과와 무관하게 항상 동일 응답.
    return { submitted: true };
}
