'use server';

import { requestPasswordReset } from '@/entities/auth';
import { getTranslations } from 'next-intl/server';
import { resolveRequestLocale } from '@/shared/i18n/requestLocale';
import { DrizzleUserRepository } from '@/entities/auth/api';
import {
    createEmailTokenStore,
    buildPasswordResetEmail,
} from '@/entities/email-token';
import type { ForgotPasswordFormState } from '@/shared/lib/auth/formTypes';
import { normalizeEmail } from '@/shared/lib/auth/validation';
import { createEmailDispatcher } from '@/shared/email';
import { getAuthDatabaseClient } from '@/entities/auth/lib/db';

/** 형식 검사만 한다 — 도메인 존재 확인이 아니다. */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function requestPasswordResetAction(
    _prev: ForgotPasswordFormState,
    formData: FormData
): Promise<ForgotPasswordFormState> {
    // 메일 링크가 요청자의 로케일을 유지해야 한다 — 없으면 ja 사용자가
    // 한국어 재설정 페이지에 떨어진다.
    const locale = await resolveRequestLocale();
    try {
        const email = normalizeEmail(String(formData.get('email') ?? ''));
        // 형식만 본다 — 계정 존재 여부는 아래에서 여전히 숨긴다.
        if (!EMAIL_SHAPE.test(email)) {
            return { submitted: false, errorCode: 'invalid_email' };
        }

        const emailTokens = createEmailTokenStore();
        // enumeration 회피: Redis 미설정·미가입 이메일을 구분할 수 없도록 항상 submitted:true 반환.
        if (!emailTokens) {
            return { submitted: true };
        }

        const { db } = getAuthDatabaseClient();
        const repo = new DrizzleUserRepository(db);
        const emailDispatcher = createEmailDispatcher();
        // 본문도 링크와 같은 로케일로 — 링크만 로케일화하고 본문을 한국어로
        // 두면 ja 사용자가 한국어 메일 안의 ja 링크를 받는다.
        const tEmail = await getTranslations({
            locale,
            namespace: 'entities.email-token.email',
        });

        // 코어 위임 — 토큰 발급·이메일 발송까지 처리, ok: true 고정 (enumeration 회피), Server Action 블로킹 의도됨.
        await requestPasswordReset(
            { email },
            { users: repo, emailTokens, emailDispatcher },
            {
                buildMessage: token =>
                    buildPasswordResetEmail({
                        email,
                        token,
                        locale,
                        t: tEmail,
                    }),
            }
        );

        return { submitted: true };
    } catch (err) {
        console.error('[requestPasswordResetAction] unexpected error:', err);
        // enumeration 회피: 에러가 발생해도 submitted:true 반환하여 이메일 존재 여부를 노출하지 않음.
        return { submitted: true };
    }
}
