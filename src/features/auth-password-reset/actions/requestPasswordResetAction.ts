'use server';

import { requestPasswordReset } from '@/entities/auth/lib/requestPasswordReset';
import { getTranslations } from 'next-intl/server';
import { resolveRequestLocale } from '@/shared/i18n/requestLocale';
import { DrizzleUserRepository } from '@/entities/auth/api';
import { createAuthRateLimitGuards } from '@/entities/auth/server/createAuthRateLimitGuards';
import { createEmailTokenStore } from '@/entities/email-token/api';
import { buildPasswordResetEmail } from '@/entities/email-token/templates/passwordResetEmail';
import type { ForgotPasswordFormState } from '@/shared/lib/auth/formTypes';
import { normalizeEmail, validateEmail } from '@/shared/lib/auth/validation';
import { createEmailDispatcher } from '@/shared/email/dispatcher';
import { getDatabaseClient } from '@/shared/db/client';
import { afterWithDrain } from '@/shared/lib/afterWithDrain';
import { redactDbErrorForLog } from '@/shared/db/redactDbErrorForLog';

/**
 * 재설정 메일 발송을 요청한다. 형식 오류와 한도 초과(`rate_limited`)만
 * `errorCode`로 알리고, 그 밖의 모든 결과(미가입·Redis 미설정·예외)는 계정
 * 열거를 막기 위해 똑같이 `submitted: true`다. 한도는 입력 주소와 IP로만
 * 정해지고 계정을 조회하기 전에 세므로 열거 신호가 아니다.
 */
export async function requestPasswordResetAction(
    _prev: ForgotPasswordFormState,
    formData: FormData
): Promise<ForgotPasswordFormState> {
    // 메일 링크가 요청자의 로케일을 유지해야 한다 — 없으면 ja 사용자가
    // 한국어 재설정 페이지에 떨어진다.
    const locale = await resolveRequestLocale();
    try {
        const email = normalizeEmail(String(formData.get('email') ?? ''));
        // 형식만 본다(도메인 존재 확인이 아니다) — 계정 존재 여부는 아래에서
        // 여전히 숨긴다.
        const emailError = validateEmail(email);
        if (emailError) {
            return { submitted: false, errorCode: emailError.code };
        }

        const emailTokens = createEmailTokenStore();
        // enumeration 회피: Redis 미설정·미가입 이메일을 구분할 수 없도록 항상 submitted:true 반환.
        if (!emailTokens) {
            return { submitted: true };
        }

        const { db } = getDatabaseClient();
        const repo = new DrizzleUserRepository(db);
        const emailDispatcher = createEmailDispatcher();
        // 본문도 링크와 같은 로케일로 — 링크만 로케일화하고 본문을 한국어로
        // 두면 ja 사용자가 한국어 메일 안의 ja 링크를 받는다.
        const tEmail = await getTranslations({
            locale,
            namespace: 'entities.email-token.email',
        });

        // 코어 위임 — 토큰 저장·메일 발송은 응답 뒤(afterWithDrain)에 돈다. 응답 경로가 계정 유무와 무관하게 같아야 한다(N69).
        const result = await requestPasswordReset(
            { email },
            {
                users: repo,
                emailTokens,
                emailDispatcher,
                deferDispatch: afterWithDrain,
                ...createAuthRateLimitGuards('passwordResetRateLimit'),
            },
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

        if (!result.ok) {
            return { submitted: false, errorCode: result.reason };
        }

        // 가입 코드 요청과 달리 발송 실패를 알리지 않는다(알 수도 없다 — 발송은 응답 뒤에 돈다):
        // 발송은 계정이 있는 주소에서만 일어나므로 실패를 드러내면 계정 존재 여부가 열거된다. 항상 submitted: true다.
        return { submitted: true };
    } catch (err) {
        console.error(
            '[requestPasswordResetAction] unexpected error:',
            redactDbErrorForLog(err)
        );
        // enumeration 회피: 에러가 발생해도 submitted:true 반환하여 이메일 존재 여부를 노출하지 않음.
        return { submitted: true };
    }
}
