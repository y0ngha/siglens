'use server';

import type { ContactFormState } from '@/domain/types';
import { validateContactInput } from '@/domain/contact/validation';
import { getDatabaseClient } from '@/shared/db/client';
import { DrizzleContactRepository } from '@/infrastructure/db/contactRepository';
import { submitInquiry } from '@/infrastructure/contact/use-cases/submitInquiry';

function getVal(formData: FormData, key: string): string {
    const val = formData.get(key);
    return typeof val === 'string' ? val : '';
}

/** Server Action: validate contact input then persist via `submitInquiry`; repo errors surface as `submission_failed` so the user can retry. */
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

    try {
        const { db } = getDatabaseClient();
        const contactRepository = new DrizzleContactRepository(db);
        await submitInquiry(validation.values, { contactRepository });
        return {
            submitted: true,
            error: null,
            values: validation.values,
        };
    } catch (error) {
        console.error(
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
