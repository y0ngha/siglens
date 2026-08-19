'use client';

import { useTranslations } from 'next-intl';
import { SubmitButton } from '@/shared/ui/auth/SubmitButton';
import { useContactForm } from '../hooks/useContactForm';
import { ContactSubmittedNotice } from './ContactSubmittedNotice';
import { ContactTextField } from './ContactTextField';
import { ContactTextareaField } from './ContactTextareaField';
import { getFieldError, getSubmissionError } from '../lib/contactFormUtils';
import { useCurrentUser } from '@/entities/auth/hooks/useCurrentUser';
import {
    CONTACT_CONTENT_MAX_LENGTH,
    CONTACT_TITLE_MAX_LENGTH,
} from '@/entities/inquiry';

export function ContactForm() {
    const t = useTranslations('features.contact-form');
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
                    className="flex items-start gap-2 rounded-md border border-ui-danger/30 bg-ui-danger/10 p-3 text-sm text-ui-danger"
                >
                    <span aria-hidden>⚠</span>
                    <p>{submissionError}</p>
                </div>
            ) : null}

            <ContactTextField
                id="contact-title"
                name="title"
                label={t('ContactForm.078b3a')}
                type="text"
                required
                maxLength={CONTACT_TITLE_MAX_LENGTH}
                placeholder={t('ContactForm.b17241')}
                defaultValue={state.values.title}
                error={getFieldError(state.error, 'title')}
            />

            {currentUser.isPending ? (
                <ContactEmailFieldSkeleton />
            ) : (
                <ContactTextField
                    id="contact-email"
                    name="email"
                    label={t('ContactForm.3c3776')}
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
                label={t('ContactForm.91c89b')}
                required
                maxLength={CONTACT_CONTENT_MAX_LENGTH}
                placeholder={t('ContactForm.52d02b')}
                defaultValue={state.values.content}
                error={getFieldError(state.error, 'content')}
            />

            <SubmitButton
                label={t('ContactForm.4de00c')}
                pendingLabel={t('ContactForm.15bde2')}
            />
        </form>
    );
}

/** Visible while the current-user query is pending; prevents a remount that would wipe user input once the query resolves. */
function ContactEmailFieldSkeleton() {
    const t = useTranslations('features.contact-form');
    return (
        <div className="space-y-2" aria-busy="true">
            <span className="block text-sm font-medium text-secondary-200">
                {t('ContactForm.3c3776')}
            </span>
            <div
                aria-hidden
                className="h-12 w-full animate-pulse rounded-md border border-secondary-700 bg-secondary-900/60"
            />
        </div>
    );
}
