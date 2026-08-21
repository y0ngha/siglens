'use server';

import { localeRedirect } from '@/shared/i18n/localeRedirect';
import {
    DrizzleOAuthAccountRepository,
    compositeOAuthRevoker,
} from '@/entities/oauth-account';
import {
    deleteAccount,
    applyAuthCookie,
    isSecureCookieEnv,
    createExpiredAuthHintCookie,
} from '@/entities/auth';
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
    // 세 문구 모두 `entities.auth.error`에 있다 — 로그인 폼이 쓰는 표와 같은
    // 자리다. 액션이 문구를 만드는 이유는 `state.error.message`가 그대로
    // `AuthErrorAlert`에 실려 나가기 때문이다.
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
        return localeRedirect('/?account_deleted=1');
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
