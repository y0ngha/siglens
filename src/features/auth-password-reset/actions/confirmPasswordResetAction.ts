'use server';

import {
    confirmPasswordReset,
    AUTH_SERVICE_UNAVAILABLE_MESSAGE,
} from '@/entities/auth';
import { DrizzleUserRepository } from '@/entities/auth/api';
import {
    bcryptPasswordHasher,
    bcryptPasswordVerifier,
} from '@/entities/auth/lib/bcrypt';
import { getAuthDatabaseClient } from '@/entities/auth/lib/db';
import { createEmailTokenStore } from '@/entities/email-token';
import { redirect } from 'next/navigation';
import type { ResetPasswordFormState } from '@/shared/lib/auth/formTypes';
import { normalizeEmail } from '@/shared/lib/auth/validation';

export async function confirmPasswordResetAction(
    _prev: ResetPasswordFormState,
    formData: FormData
): Promise<ResetPasswordFormState> {
    try {
        const email = normalizeEmail(String(formData.get('email') ?? ''));
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
    } catch (err) {
        if (err instanceof Error && err.message.startsWith('NEXT_REDIRECT'))
            throw err;
        console.error('[confirmPasswordResetAction] unexpected error:', err);
        return {
            error: {
                code: 'unexpected',
                message:
                    '비밀번호 재설정 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
            },
        };
    }
}
