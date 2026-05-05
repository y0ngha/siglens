'use server';

import { DrizzleUserRepository } from '@/infrastructure/db/userRepository';
import {
    bcryptPasswordHasher,
    bcryptPasswordVerifier,
} from '@/infrastructure/auth/bcrypt';
import { confirmPasswordReset } from '@/infrastructure/auth/use-cases/confirmPasswordReset';
import { createEmailTokenStore } from '@/infrastructure/email/tokenStore';
import { redirect } from 'next/navigation';
import type { ResetPasswordFormState } from '@/domain/auth/formTypes';
import { getAuthDatabaseClient } from '@/infrastructure/auth/db';
import { AUTH_SERVICE_UNAVAILABLE_MESSAGE } from '@/infrastructure/auth/errorMessages';

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
                code: 'redis_unavailable',
                message: AUTH_SERVICE_UNAVAILABLE_MESSAGE,
            },
        };
    }

    const { db } = getAuthDatabaseClient();
    // DrizzleUserRepository가 emailAuthUsers와 users 두 인터페이스를 모두 구현하므로 동일 인스턴스 전달.
    const userRepo = new DrizzleUserRepository(db);
    const result = await confirmPasswordReset(
        { email, token, newPassword },
        {
            emailAuthUsers: userRepo,
            users: userRepo,
            emailTokens,
            passwordHasher: bcryptPasswordHasher,
            passwordVerifier: bcryptPasswordVerifier,
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
