'use client';

import { SubmitButton } from '@/components/auth/SubmitButton';
import { useContactForm } from '@/components/contact/hooks/useContactForm';
import { ContactSubmittedNotice } from '@/components/contact/ContactSubmittedNotice';
import { ContactTextField } from '@/components/contact/ContactTextField';
import { ContactTextareaField } from '@/components/contact/ContactTextareaField';
import {
    getFieldError,
    getSubmissionError,
} from '@/components/contact/utils/contactFormUtils';
import { useCurrentUser } from '@/components/hooks/useCurrentUser';
import {
    CONTACT_CONTENT_MAX_LENGTH,
    CONTACT_TITLE_MAX_LENGTH,
} from '@/domain/contact/constants';

export function ContactForm() {
    const [state, formAction] = useContactForm();
    const currentUser = useCurrentUser();

    if (state.submitted) {
        return <ContactSubmittedNotice />;
    }

    const submissionError = getSubmissionError(state.error);
    const emailDefault = state.error
        ? state.values.email
        : (currentUser.data?.email ?? '');

    return (
        <form action={formAction} className="space-y-4" noValidate>
            {submissionError ? (
                <div
                    role="alert"
                    className="border-ui-danger/30 bg-ui-danger/10 text-ui-danger flex items-start gap-2 rounded-md border p-3 text-sm"
                >
                    <span aria-hidden>⚠</span>
                    <p>{submissionError}</p>
                </div>
            ) : null}

            <ContactTextField
                id="contact-title"
                name="title"
                label="제목"
                type="text"
                required
                autoFocus
                maxLength={CONTACT_TITLE_MAX_LENGTH}
                placeholder="문의 제목을 입력해 주세요"
                defaultValue={state.values.title}
                error={getFieldError(state.error, 'title')}
            />

            <ContactTextField
                key={currentUser.data?.email ?? 'loading'}
                id="contact-email"
                name="email"
                label="이메일"
                type="email"
                autoComplete="email"
                required
                placeholder="answer@example.com"
                defaultValue={emailDefault}
                error={getFieldError(state.error, 'email')}
            />

            <ContactTextareaField
                id="contact-content"
                name="content"
                label="문의 내용"
                required
                maxLength={CONTACT_CONTENT_MAX_LENGTH}
                placeholder="자세한 내용을 입력해 주세요"
                defaultValue={state.values.content}
                error={getFieldError(state.error, 'content')}
            />

            <SubmitButton label="문의 보내기" pendingLabel="전송 중…" />
        </form>
    );
}
