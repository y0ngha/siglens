'use server';

import { getDatabaseClient } from '@/shared/db/client';
import { scheduleOperatorNotification } from '@/shared/email/operatorNotifier';
import { logActionError } from '@/shared/lib/logActionError';
import type { ContactFormState } from '@/shared/lib/types';
import { DrizzleContactRepository } from '../api';
import { submitInquiry } from '../lib/submitInquiry';
import {
    isHoneypotFilled,
    isInquiryRateLimited,
} from '../server/inquirySpamGuard';
import { validateContactInput } from '../lib/validation';

/** FormData 값이 문자열이 아니거나 없으면 빈 문자열로 정규화한다. */
function getVal(formData: FormData, key: string): string {
    const val = formData.get(key);
    return typeof val === 'string' ? val : '';
}

/**
 * 문의 폼 Server Action. 입력을 검증한 뒤 저장하며, 저장 실패는 내부 정보 없이
 * `submission_failed`로만 노출해 사용자가 재시도할 수 있게 한다.
 *
 * 스팸 방어: honeypot(`siglens_hp_ignore`)이 채워져 있으면 봇에게 단서를 주지 않도록 성공처럼
 * 응답하고 저장·메일을 하지 않는다. 이어서 IP 해시 rate limit(5/h)을 건다 —
 * 초과하면 `rate_limited`다(Redis 장애는 fail-open).
 * 소비자: features/contact-form `useContactForm`.
 */
export async function submitContactAction(
    _prev: ContactFormState,
    formData: FormData
): Promise<ContactFormState> {
    const rawValues = {
        title: getVal(formData, 'title'),
        email: getVal(formData, 'email'),
        content: getVal(formData, 'content'),
    };

    if (isHoneypotFilled(formData)) {
        return { submitted: true, error: null, values: rawValues };
    }

    const validation = validateContactInput(rawValues);
    if (!validation.ok) {
        return {
            submitted: false,
            error: validation.error,
            values: rawValues,
        };
    }

    try {
        if (await isInquiryRateLimited()) {
            return {
                submitted: false,
                error: { code: 'rate_limited' },
                values: rawValues,
            };
        }
        const { db } = getDatabaseClient();
        const contactRepository = new DrizzleContactRepository(db);
        await submitInquiry(validation.values, {
            contactRepository,
            notifier: message =>
                scheduleOperatorNotification(message, '[submitContactAction]'),
        });
        return {
            submitted: true,
            error: null,
            values: validation.values,
        };
    } catch (error) {
        // DrizzleQueryError 메시지에 바인딩된 이메일·본문이 들어 있어 원문 대신 이름/코드만 남긴다.
        logActionError(
            '[submitContactAction] Failed to persist contact inquiry',
            error
        );
        return {
            submitted: false,
            error: { code: 'submission_failed' },
            values: rawValues,
        };
    }
}
