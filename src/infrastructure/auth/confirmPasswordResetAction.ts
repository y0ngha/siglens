'use server';

import {
    DrizzleUserRepository,
    bcryptPasswordHasher,
    confirmPasswordReset,
} from '@y0ngha/siglens-core';
import { redirect } from 'next/navigation';
import type { ResetPasswordFormState } from '@/domain/auth/formTypes';
import { getAuthDatabaseClient } from './db';
import { passwordResetTokenHasher } from './passwordResetTokenService';

export async function confirmPasswordResetAction(
    _prev: ResetPasswordFormState,
    formData: FormData
): Promise<ResetPasswordFormState> {
    const token = String(formData.get('token') ?? '');
    const newPassword = String(formData.get('newPassword') ?? '');

    const { db } = getAuthDatabaseClient();
    const result = await confirmPasswordReset(
        { token, newPassword },
        {
            passwordResets: new DrizzleUserRepository(db),
            passwordHasher: bcryptPasswordHasher,
            tokenHasher: passwordResetTokenHasher,
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
