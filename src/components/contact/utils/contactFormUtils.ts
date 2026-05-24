import type { ContactFormError, ContactFormField } from '@/shared/lib/types';
import { CONTACT_ERROR_MESSAGES } from '@/shared/lib/contactErrorMessages';

export function getFieldError(
    error: ContactFormError | null,
    field: ContactFormField
): string | undefined {
    return error?.field === field
        ? CONTACT_ERROR_MESSAGES[error.code]
        : undefined;
}

export function getSubmissionError(
    error: ContactFormError | null
): string | undefined {
    return error && error.field === undefined
        ? CONTACT_ERROR_MESSAGES[error.code]
        : undefined;
}
