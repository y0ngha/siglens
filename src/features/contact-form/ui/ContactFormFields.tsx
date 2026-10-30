'use client';

import { useRef } from 'react';
import { useTranslations } from 'next-intl';
import { SubmitButton } from '@/shared/ui/auth/SubmitButton';
import { ErrorAlert } from '@/shared/ui/ErrorAlert';
import { TextField } from '@/shared/ui/TextField';
import type { ContactFormState } from '@/shared/lib/types';
import { useCurrentUser } from '@/entities/auth/hooks/useCurrentUser';
import {
    CONTACT_CONTENT_MAX_LENGTH,
    CONTACT_TITLE_MAX_LENGTH,
} from '@/shared/config/contact';
import type { useContactForm } from '../hooks/useContactForm';
import { useFocusInvalidFieldOnError } from '../hooks/useFocusInvalidFieldOnError';
import {
    getFieldError,
    getSubmissionError,
    resolveEmailDefault,
} from '../lib/contactFormUtils';
import { ContactEmailField } from './ContactEmailField';
import { ContactTextareaField } from './ContactTextareaField';

interface ContactFormFieldsProps {
    /** 직전 액션 결과 — 오류와 사용자가 보낸 값(비제어 입력의 기본값)을 싣는다. */
    state: ContactFormState;
    formAction: ReturnType<typeof useContactForm>[1];
}

/**
 * 제출 전·오류 후의 문의 입력 폼. 입력은 모두 비제어라, 액션이 돌려준 값을
 * `defaultValue`로 되살리고 오류가 오면 첫 오류 필드로 포커스를 옮긴다.
 */
export function ContactFormFields({
    state,
    formAction,
}: ContactFormFieldsProps) {
    const formRef = useRef<HTMLFormElement>(null);
    const t = useTranslations('features.contact-form');
    const tError = useTranslations('shared.lib.contactError');
    const currentUser = useCurrentUser();
    useFocusInvalidFieldOnError(formRef, state.error);

    const submissionError = getSubmissionError(state.error, tError);

    return (
        <form
            ref={formRef}
            action={formAction}
            className="space-y-4"
            noValidate
        >
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

            <ContactEmailField
                isPending={currentUser.isPending}
                defaultValue={resolveEmailDefault(
                    state,
                    currentUser.data?.email
                )}
                error={getFieldError(state.error, 'email', tError)}
            />

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
