'use server';

import {
    DrizzleUserRepository,
    bcryptPasswordHasher,
    confirmPasswordReset,
    createEmailTokenStore,
} from '@y0ngha/siglens-core';
import { redirect } from 'next/navigation';
import type { ResetPasswordFormState } from '@/domain/auth/formTypes';
import { getAuthDatabaseClient } from './db';

const REDIS_UNAVAILABLE_MESSAGE =
    '서비스가 일시적으로 동작하지 않습니다. 잠시 후 다시 시도해주세요.';

export async function confirmPasswordResetAction(
    _prev: ResetPasswordFormState,
    formData: FormData
): Promise<ResetPasswordFormState> {
    const email = String(formData.get('email') ?? '').trim();
    const token = String(formData.get('token') ?? '');
    const newPassword = String(formData.get('newPassword') ?? '');

    const emailTokens = createEmailTokenStore();
    if (!emailTokens) {
        return {
            error: {
                code: 'invalid_token',
                message: REDIS_UNAVAILABLE_MESSAGE,
            },
        };
    }

    const { db } = getAuthDatabaseClient();
    const userRepo = new DrizzleUserRepository(db);
    const result = await confirmPasswordReset(
        { email, token, newPassword },
        {
            emailAuthUsers: userRepo,
            users: userRepo,
            emailTokens,
            passwordHasher: bcryptPasswordHasher,
        }
    );

    if (!result.ok) {
        return {
            error: {
                code: result.error.code,
                field: result.error.field,
                message: result.error.message,
            },
        };
    }

    redirect('/login?password_reset=1');
}
