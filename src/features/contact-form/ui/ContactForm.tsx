'use client';

import { useTranslations } from 'next-intl';
import { SuccessNotice } from '@/shared/ui/SuccessNotice';
import { useContactForm } from '../hooks/useContactForm';
import { ContactFormFields } from './ContactFormFields';

/**
 * 문의 다이얼로그의 본문. 성공 시 폼이 통째로 사라진다 — 포커스·알림 처리는
 * `SuccessNotice` 참고.
 */
export function ContactForm() {
    const t = useTranslations('features.contact-form');
    const [state, formAction] = useContactForm();

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
                <ContactFormFields state={state} formAction={formAction} />
            )}
        </>
    );
}
