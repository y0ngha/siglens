'use client';

import { useTranslations } from 'next-intl';
import { SubmitButton } from '@/shared/ui/auth/SubmitButton';
import { ErrorAlert } from '@/shared/ui/ErrorAlert';
import { TextField } from '@/shared/ui/TextField';
import { SuccessNotice } from '@/shared/ui/SuccessNotice';
import { useContactForm } from '../hooks/useContactForm';
import { ContactTextareaField } from './ContactTextareaField';
import { getFieldError, getSubmissionError } from '../lib/contactFormUtils';
import { useCurrentUser } from '@/entities/auth/hooks/useCurrentUser';
import {
    CONTACT_CONTENT_MAX_LENGTH,
    CONTACT_TITLE_MAX_LENGTH,
} from '@/shared/config/contact';

/** 성공 시 폼이 통째로 사라진다 — 포커스·알림 처리는 `SuccessNotice` 참고. */
export function ContactForm() {
    const t = useTranslations('features.contact-form');
    const [state, formAction] = useContactForm();
    const currentUser = useCurrentUser();

    return (
        <>
            <SuccessNotice
                show={state.submitted}
                title={t('ContactSubmittedNotice.820d69')}
                messages={[
                    t('ContactSubmittedNotice.5483d6'),
                    t('ContactSubmittedNotice.679be7'),
                ]}
            />
            {state.submitted ? null : (
                <ContactFormFields
                    state={state}
                    formAction={formAction}
                    currentUser={currentUser}
                />
            )}
        </>
    );
}

interface ContactFormFieldsProps {
    state: ReturnType<typeof useContactForm>[0];
    formAction: ReturnType<typeof useContactForm>[1];
    currentUser: ReturnType<typeof useCurrentUser>;
}

function ContactFormFields({
    state,
    formAction,
    currentUser,
}: ContactFormFieldsProps) {
    const t = useTranslations('features.contact-form');
    const tError = useTranslations('shared.lib.contactError');
    const submissionError = getSubmissionError(state.error, tError);

    // Email field is uncontrolled (defaultValue). Once the form has been
    // re-rendered with an action result, prefer the user's input over the
    // logged-in email so we don't clobber what they typed.
    const emailDefault = state.error
        ? state.values.email
        : (currentUser.data?.email ?? '');

    return (
        <form action={formAction} className="space-y-4" noValidate>
            {submissionError ? <ErrorAlert message={submissionError} /> : null}

            <TextField
                id="contact-title"
                name="title"
                label={t('ContactForm.078b3a')}
                type="text"
                required
                maxLength={CONTACT_TITLE_MAX_LENGTH}
                placeholder={t('ContactForm.b17241')}
                defaultValue={state.values.title}
                error={getFieldError(state.error, 'title', tError)}
            />

            {currentUser.isPending ? (
                <ContactEmailFieldSkeleton />
            ) : (
                <TextField
                    id="contact-email"
                    name="email"
                    label={t('ContactForm.3c3776')}
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="answer@example.com"
                    defaultValue={emailDefault}
                    error={getFieldError(state.error, 'email', tError)}
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
                error={getFieldError(state.error, 'content', tError)}
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
                className="h-12 w-full animate-pulse rounded-lg border border-secondary-700 bg-secondary-900/60"
            />
        </div>
    );
}
