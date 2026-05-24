'use client';

import { SubmitButton } from '@/shared/ui/auth/SubmitButton';
import { useContactForm } from '../hooks/useContactForm';
import { ContactSubmittedNotice } from './ContactSubmittedNotice';
import { ContactTextField } from './ContactTextField';
import { ContactTextareaField } from './ContactTextareaField';
import { getFieldError, getSubmissionError } from '../lib/contactFormUtils';
import { useCurrentUser } from '@/entities/session';
import {
    CONTACT_CONTENT_MAX_LENGTH,
    CONTACT_TITLE_MAX_LENGTH,
} from '@/entities/inquiry';

export function ContactForm() {
    const [state, formAction] = useContactForm();
    const currentUser = useCurrentUser();

    if (state.submitted) {
        return <ContactSubmittedNotice />;
    }

    const submissionError = getSubmissionError(state.error);

    // Email field is uncontrolled (defaultValue). Once the form has been
    // re-rendered with an action result, prefer the user's input over the
    // logged-in email so we don't clobber what they typed.
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

            {currentUser.isPending ? (
                <ContactEmailFieldSkeleton />
            ) : (
                <ContactTextField
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
            )}

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

/** Visible while the current-user query is pending; prevents a remount that would wipe user input once the query resolves. */
function ContactEmailFieldSkeleton() {
    return (
        <div className="space-y-2" aria-busy="true">
            <span className="text-secondary-200 block text-sm font-medium">
                이메일
            </span>
            <div
                aria-hidden
                className="border-secondary-700 bg-secondary-900/60 h-12 w-full animate-pulse rounded-md border"
            />
        </div>
    );
}
