'use server';

import type { ContactFormState } from '@/domain/types';
import { validateContactInput } from '@/domain/contact/validation';

function getVal(formData: FormData, key: string): string {
    const val = formData.get(key);
    return typeof val === 'string' ? val : '';
}

export async function submitContactAction(
    _prev: ContactFormState,
    formData: FormData
): Promise<ContactFormState> {
    const rawValues = {
        title: getVal(formData, 'title'),
        email: getVal(formData, 'email'),
        content: getVal(formData, 'content'),
    };

    const validation = validateContactInput(rawValues);
    if (!validation.ok) {
        return {
            submitted: false,
            error: validation.error,
            values: rawValues,
        };
    }

    // TODO(#398): submitContactInquiry 호출로 교체
    return {
        submitted: false,
        error: { code: 'submission_failed' },
        values: validation.values,
    };
}
