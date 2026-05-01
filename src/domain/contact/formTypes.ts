export type ContactFormField = 'title' | 'email' | 'content';

export type ContactFormErrorCode =
    | 'title_required'
    | 'title_too_long'
    | 'email_required'
    | 'email_invalid'
    | 'content_required'
    | 'content_too_long'
    | 'submission_failed';

export interface ContactFormError {
    code: ContactFormErrorCode;
    field?: ContactFormField;
}

export interface ContactFormValues {
    title: string;
    email: string;
    content: string;
}

export interface ContactFormState {
    submitted: boolean;
    error: ContactFormError | null;
    values: ContactFormValues;
}
