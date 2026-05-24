'use server';

import { verifyEmail } from '@/infrastructure/auth/use-cases/verifyEmail';
import { createEmailTokenStore } from '@/infrastructure/email/tokenStore';
import type { VerifyEmailFormState } from '@/domain/auth/formTypes';
import { AUTH_SERVICE_UNAVAILABLE_MESSAGE } from '@/infrastructure/auth/errorMessages';
import { getAuthDatabaseClient } from '@/infrastructure/auth/db';
import { DrizzleUserRepository } from '@/entities/user';
import { normalizeEmail } from '@/domain/auth/validation';

export async function verifyEmailAction(
    _prev: VerifyEmailFormState,
    formData: FormData
): Promise<VerifyEmailFormState> {
    const email = String(formData.get('email') ?? '').trim();
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
            error: { code: result.error.code, message: result.error.message },
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
}
