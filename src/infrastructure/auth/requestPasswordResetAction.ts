'use server';

import {
    DrizzleUserRepository,
    requestPasswordReset,
} from '@y0ngha/siglens-core';
import type { ForgotPasswordFormState } from '@/domain/auth/formTypes';
import { buildPasswordResetEmail } from '@/infrastructure/email/passwordResetEmail';
import { createEmailDispatcher } from '@/infrastructure/email/resend';
import { getAuthDatabaseClient } from './db';
import {
    passwordResetTokenGenerator,
    passwordResetTokenHasher,
} from './passwordResetTokenService';

export async function requestPasswordResetAction(
    _prev: ForgotPasswordFormState,
    formData: FormData
): Promise<ForgotPasswordFormState> {
    const email = String(formData.get('email') ?? '').trim();

    const { db } = getAuthDatabaseClient();
    const repo = new DrizzleUserRepository(db);
    const result = await requestPasswordReset(
        { email },
        {
            users: repo,
            passwordResets: repo,
            tokenGenerator: passwordResetTokenGenerator,
            tokenHasher: passwordResetTokenHasher,
        }
    );

    if (result.token !== null) {
        const dispatcher = createEmailDispatcher();
        const message = buildPasswordResetEmail({
            to: email,
            token: result.token,
            expiresAt: result.expiresAt,
        });
        // fire-and-forget — 발송 결과를 기다리지 않는다. dispatcher.sendEmail은 boolean을
        // 반환하며 내부에서 에러를 swallow하므로 caller로 예외가 새지 않는다.
        // enumeration 방지를 위해 발송 성공/실패와 무관하게 동일한 응답을 반환한다.
        void dispatcher.sendEmail(message);
    }

    return { submitted: true };
}
