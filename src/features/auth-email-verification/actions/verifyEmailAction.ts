'use server';

import { DrizzleUserRepository, verifyEmail } from '@/entities/user';
import { createEmailTokenStore } from '@/entities/email-token';
import type { VerifyEmailFormState } from '@/shared/lib/auth/formTypes';
import {
    AUTH_SERVICE_UNAVAILABLE_MESSAGE,
    getAuthDatabaseClient,
} from '@/entities/session';
import { normalizeEmail } from '@/shared/lib/auth/validation';

export async function verifyEmailAction(
    _prev: VerifyEmailFormState,
    formData: FormData
): Promise<VerifyEmailFormState> {
    try {
        const email = normalizeEmail(String(formData.get('email') ?? ''));
        const code = String(formData.get('code') ?? '').trim();

        const emailTokens = createEmailTokenStore();
        if (!emailTokens) {
            return {
                verified: false,
                error: {
                    code: 'redis_unavailable',
                    message: AUTH_SERVICE_UNAVAILABLE_MESSAGE,
                },
            };
        }
        const result = await verifyEmail({ email, code }, { emailTokens });

        if (!result.ok) {
            return {
                verified: false,
                error: {
                    code: result.error.code,
                    message: result.error.message,
                },
            };
        }

        const { db } = getAuthDatabaseClient();
        const userRepo = new DrizzleUserRepository(db);
        const existing = await userRepo.findByEmail(normalizeEmail(email));

        if (existing !== null) {
            return {
                verified: false,
                error: {
                    code: 'email_already_exists',
                    message: '이미 가입된 이메일 주소입니다. 로그인해 주세요.',
                },
            };
        }

        return { verified: true, error: null };
    } catch (err) {
        console.error('[verifyEmailAction] unexpected error:', err);
        return {
            verified: false,
            error: {
                code: 'unexpected',
                message:
                    '이메일 인증 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
            },
        };
    }
}
