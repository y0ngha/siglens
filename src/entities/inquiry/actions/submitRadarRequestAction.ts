'use server';

import { getDatabaseClient } from '@/shared/db/client';
import { logActionError } from '@/shared/lib/logActionError';
import { DrizzleContactRepository } from '../api';
import { validateRadarRequestInput } from '../lib/radarRequestValidation';
import { submitInquiry } from '../lib/submitInquiry';
import type { RadarRequestFormState } from '../lib/types';

/** FormData 값이 문자열이 아니거나 없으면 빈 문자열로 정규화한다. */
function getVal(formData: FormData, key: string): string {
    const val = formData.get(key);
    return typeof val === 'string' ? val : '';
}

/**
 * 레이더 종목 요청 폼 Server Action. 문의 테이블에 제목 접두어로 구분해 저장하며,
 * 저장 실패는 내부 정보 없이 `submission_failed`로만 노출해 사용자가 재시도할 수 있게 한다.
 * 소비자: features/radar-request `useRadarRequestForm`.
 */
export async function submitRadarRequestAction(
    _prev: RadarRequestFormState,
    formData: FormData
): Promise<RadarRequestFormState> {
    const rawValues = {
        symbol: getVal(formData, 'symbol'),
        email: getVal(formData, 'email'),
    };

    const validation = validateRadarRequestInput(rawValues);
    if (!validation.ok) {
        return {
            submitted: false,
            error: validation.error,
            values: rawValues,
        };
    }

    try {
        const { db } = getDatabaseClient();
        const contactRepository = new DrizzleContactRepository(db);
        await submitInquiry(validation.values, { contactRepository });
        return {
            submitted: true,
            error: null,
            // 저장된 값 그대로 — 이메일을 비웠으면 `null`이 아니라 빈 문자열로 돌려준다.
            values: {
                symbol: validation.values.content,
                email: validation.values.email ?? '',
            },
        };
    } catch (error) {
        // DrizzleQueryError 메시지에 바인딩된 이메일·종목이 들어 있어 원문 대신 이름/코드만 남긴다.
        logActionError(
            '[submitRadarRequestAction] Failed to persist radar request',
            error
        );
        return {
            submitted: false,
            error: { code: 'submission_failed' },
            values: rawValues,
        };
    }
}
