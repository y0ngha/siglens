'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
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
} from '@/shared/config/contact';

/**
 * 성공 시 폼이 통째로 사라지므로 **포커스와 알림을 명시적으로 다룬다.**
 *
 * 예전에는 `state.submitted`에서 곧장 성공 안내만 반환했다. 그러면 (1) 포커스를 쥐고
 * 있던 제출 버튼이 언마운트돼 포커스가 `<body>`로 떨어지고, (2) `aria-live` 영역이
 * 내용과 같은 순간에 삽입돼 보조기술에 따라 아무것도 읽지 않는다.
 *
 * 그래서 라이브 영역은 항상 렌더해 두고 안쪽 내용만 바꾸며, 성공 패널이 마운트되면
 * 포커스를 옮긴다. ForgotPasswordForm과 같은 패턴이다.
 */
export function ContactForm() {
    const [state, formAction] = useContactForm();
    const currentUser = useCurrentUser();
    const noticeRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (state.submitted) noticeRef.current?.focus();
    }, [state.submitted]);

    return (
        <>
            {/* 라이브 영역은 제출 전에도 비어 있는 채로 존재한다. */}
            <div role="status" aria-live="polite">
                {state.submitted ? (
                    <ContactSubmittedNotice ref={noticeRef} />
                ) : null}
            </div>
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
            {submissionError ? (
                <div
                    role="alert"
                    className="flex items-start gap-2 rounded-lg border border-ui-danger/30 bg-ui-danger/10 p-3 text-sm text-ui-danger-text"
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
                error={getFieldError(state.error, 'title', tError)}
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
