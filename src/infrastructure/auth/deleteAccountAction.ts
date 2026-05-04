'use server';

import { DrizzleOAuthAccountRepository } from '@/infrastructure/db/oauthAccountRepository';
import { DrizzleUserRepository } from '@/infrastructure/db/userRepository';
import { deleteAccount } from '@/infrastructure/auth/use-cases/deleteAccount';
import { compositeOAuthRevoker } from '@/infrastructure/auth/oauth/revoker';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { DeleteAccountFormState } from '@/domain/auth/formTypes';
import { applyAuthCookie } from '@/infrastructure/auth/applyAuthCookie';
import { getAuthDatabaseClient } from '@/infrastructure/auth/db';
import { getCurrentUser } from '@/infrastructure/auth/getCurrentUser';
import { isSecureCookieEnv } from '@/infrastructure/auth/sessionCookieOptions';
import { createExpiredAuthHintCookie } from '@/infrastructure/auth/authHintCookie';

const NOT_AUTHENTICATED_MESSAGE = '로그인이 필요합니다.';
const EMAIL_MISMATCH_MESSAGE =
    '입력한 이메일이 계정의 이메일과 일치하지 않습니다.';

export async function deleteAccountAction(
    _prev: DeleteAccountFormState,
    formData: FormData
): Promise<DeleteAccountFormState> {
    const confirmEmail = String(formData.get('email') ?? '')
        .trim()
        .toLowerCase();

    const user = await getCurrentUser();
    if (!user) {
        return {
            error: {
                code: 'not_authenticated',
                message: NOT_AUTHENTICATED_MESSAGE,
            },
        };
    }

    if (confirmEmail !== user.email.toLowerCase()) {
        return {
            error: { code: 'email_mismatch', message: EMAIL_MISMATCH_MESSAGE },
        };
    }

    const { db } = getAuthDatabaseClient();
    const result = await deleteAccount(
        { userId: user.id },
        {
            users: new DrizzleUserRepository(db),
            oauthAccounts: new DrizzleOAuthAccountRepository(db),
            oauthRevoker: compositeOAuthRevoker,
        },
        { secureCookie: isSecureCookieEnv() }
    );

    if (!result.ok) {
        return {
            error: { code: result.error.code, message: result.error.message },
        };
    }

    const cookieStore = await cookies();
    cookieStore.set(applyAuthCookie(result.cookie));
    cookieStore.set(
        createExpiredAuthHintCookie({ secure: isSecureCookieEnv() })
    );
    redirect('/?account_deleted=1');
}
