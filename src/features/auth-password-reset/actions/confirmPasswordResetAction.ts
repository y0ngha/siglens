'use server';

import { getTranslations } from 'next-intl/server';

import { localeRedirect } from '@/shared/i18n/localeRedirect';
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
import type { ResetPasswordFormState } from '@/shared/lib/auth/formTypes';
import { normalizeEmail } from '@/shared/lib/auth/validation';

export async function confirmPasswordResetAction(
    _prev: ResetPasswordFormState,
    formData: FormData
): Promise<ResetPasswordFormState> {
    // 상태의 `message`가 그대로 화면에 뿌려지므로 요청 로케일로 만든다.
    const tAuth = await getTranslations('entities.auth.error');
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

        return localeRedirect('/login?password_reset=1');
    } catch (err) {
        if (err instanceof Error && err.message.startsWith('NEXT_REDIRECT'))
            throw err;
        console.error('[confirmPasswordResetAction] unexpected error:', err);
        return {
            error: {
                code: 'unexpected',
                message: tAuth('passwordResetFailed'),
            },
        };
    }
}
