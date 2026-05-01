'use server';

import type { ContactFormState } from '@/domain/contact/formTypes';
import { validateContactInput } from '@/domain/contact/validation';

export async function submitContactAction(
    _prev: ContactFormState,
    formData: FormData
): Promise<ContactFormState> {
    const rawValues = {
        title: String(formData.get('title') ?? ''),
        email: String(formData.get('email') ?? ''),
        content: String(formData.get('content') ?? ''),
    };

    const validation = validateContactInput(rawValues);
    if (!validation.ok) {
        return {
            submitted: false,
            error: validation.error,
            values: rawValues,
        };
    }

    // TODO(#398): siglens-core 의 ContactSubmissionRepository / submitContactInquiry
    // 머지되면 여기서 호출. 현재는 검증만 통과하면 즉시 성공 처리.
    // import { DrizzleContactSubmissionRepository, submitContactInquiry } from '@y0ngha/siglens-core';
    // const { db } = getAuthDatabaseClient();
    // const repo = new DrizzleContactSubmissionRepository(db);
    // const result = await submitContactInquiry(validation.values, { repository: repo });
    // if (!result.ok) {
    //     return {
    //         submitted: false,
    //         error: { code: 'submission_failed', message: '문의 접수 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
    //         values: rawValues,
    //     };
    // }

    return {
        submitted: true,
        error: null,
        values: { title: '', email: '', content: '' },
    };
}
