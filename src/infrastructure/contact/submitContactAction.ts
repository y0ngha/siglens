'use server';

import type { ContactFormState } from '@/domain/contact/formTypes';
import { validateContactInput } from '@/domain/contact/validation';

export async function submitContactAction(
    _prev: ContactFormState,
    formData: FormData
): Promise<ContactFormState> {
    const getVal = (key: string) => {
        const val = formData.get(key);
        return typeof val === 'string' ? val : '';
    };

    const rawValues = {
        title: getVal('title'),
        email: getVal('email'),
        content: getVal('content'),
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
