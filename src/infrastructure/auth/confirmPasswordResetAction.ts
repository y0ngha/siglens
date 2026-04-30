'use server';

import {
    DrizzleUserRepository,
    bcryptPasswordHasher,
} from '@y0ngha/siglens-core';
import { redirect } from 'next/navigation';
import type { ResetPasswordFormState } from '@/domain/auth/formTypes';
// TODO(siglens-core#55): replace with real exports once the new core ships.
import {
    createEmailTokenStore,
    confirmPasswordResetV2,
} from '@/domain/auth/coreStubs';
import { getAuthDatabaseClient } from './db';

export async function confirmPasswordResetAction(
    _prev: ResetPasswordFormState,
    formData: FormData
): Promise<ResetPasswordFormState> {
    const email = String(formData.get('email') ?? '').trim();
    const token = String(formData.get('token') ?? '');
    const newPassword = String(formData.get('newPassword') ?? '');

    const { db } = getAuthDatabaseClient();
    const result = await confirmPasswordResetV2(
        { email, token, newPassword },
        {
            users: new DrizzleUserRepository(db),
            passwordHasher: bcryptPasswordHasher,
            emailTokens: createEmailTokenStore(),
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
