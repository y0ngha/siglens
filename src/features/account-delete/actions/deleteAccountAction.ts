'use server';

import { DrizzleOAuthAccountRepository } from '@/entities/oauth-account';
import { DrizzleUserRepository } from '@/entities/user';
import { deleteAccount } from '@/entities/user/lib/deleteAccount';
import { compositeOAuthRevoker } from '@/entities/oauth-account/lib/revoker';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { DeleteAccountFormState } from '@/shared/lib/auth/formTypes';
import { applyAuthCookie } from '@/entities/session/lib/applyAuthCookie';
import { getAuthDatabaseClient } from '@/entities/session/lib/db';
import { getCurrentUser } from '@/entities/session/lib/getCurrentUser';
import { isSecureCookieEnv } from '@/entities/session/lib/sessionCookieOptions';
import { createExpiredAuthHintCookie } from '@/entities/session/lib/authHintCookie';

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
