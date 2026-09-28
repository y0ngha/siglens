'use server';

import { localeRedirect } from '@/shared/i18n/localeRedirect';
import { DrizzleOAuthAccountRepository } from '@/entities/oauth-account/api';
import { compositeOAuthRevoker } from '@/entities/oauth-account/lib/revoker';
import { deleteAccount } from '@/entities/auth/lib/deleteAccount';
import { applyAuthCookie } from '@/entities/auth/lib/applyAuthCookie';
import { isSecureCookieEnv } from '@/entities/auth/lib/sessionCookieOptions';
import { createExpiredAuthHintCookie } from '@/entities/auth/lib/authHintCookie';
import { DrizzleUserRepository } from '@/entities/auth/api';
import { cookies } from 'next/headers';
import type { DeleteAccountFormState } from '@/shared/lib/auth/formTypes';
import { normalizeEmail } from '@/shared/lib/auth/validation';
import { getAuthDatabaseClient } from '@/entities/auth/lib/db';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { getTranslations } from 'next-intl/server';

export async function deleteAccountAction(
    _prev: DeleteAccountFormState,
    formData: FormData
): Promise<DeleteAccountFormState> {
    // 화면 표시는 `DeleteAccountConfirm`이 에러 `code`로 번역한다(`AUTH_ERROR_KEY`).
    // 여기서 만드는 `message`는 로그·폴백용이다 — `deleteAccount`가 그대로 넘기는
    // 코드의 `message`는 한국어 원문이라 UI가 `message`를 믿으면 안 된다.
    const tAuth = await getTranslations('entities.auth.error');
    try {
        const confirmEmail = normalizeEmail(
            String(formData.get('email') ?? '')
        );

        const user = await getCurrentUser();
        if (!user) {
            return {
                error: {
                    code: 'not_authenticated',
                    message: tAuth('notAuthenticated'),
                },
            };
        }

        if (confirmEmail !== user.email.toLowerCase()) {
            return {
                error: {
                    code: 'email_mismatch',
                    message: tAuth('emailMismatch'),
                },
            };
        }

        const secure = isSecureCookieEnv();
        const { db } = getAuthDatabaseClient();
        const result = await deleteAccount(
            { userId: user.id },
            {
                users: new DrizzleUserRepository(db),
                oauthAccounts: new DrizzleOAuthAccountRepository(db),
                oauthRevoker: compositeOAuthRevoker,
            },
            { secureCookie: secure }
        );

        if (!result.ok) {
            return {
                error: {
                    code: result.error.code,
                    message: result.error.message,
                },
            };
        }

        const cookieStore = await cookies();
        cookieStore.set(applyAuthCookie(result.cookie));
        cookieStore.set(createExpiredAuthHintCookie({ secure }));
        // 예전엔 `/?account_deleted=1`로 보냈지만 그 쿼리를 읽는 곳이 없었다 —
        // 받을 쪽 없는 파라미터는 URL에 남아 공유·북마크만 더럽힌다.
        return localeRedirect('/');
    } catch (err) {
        if (err instanceof Error && err.message.startsWith('NEXT_REDIRECT'))
            throw err;
        console.error('[deleteAccountAction] unexpected error:', err);
        return {
            error: {
                code: 'unexpected',
                message: tAuth('accountDeleteFailed'),
            },
        };
    }
}
