'use client';

import { useTranslations } from 'next-intl';
import { AuthFieldGroup } from '@/shared/ui/auth/AuthFieldGroup';
import { SubmitButton } from '@/shared/ui/auth/SubmitButton';
import { useForgotPasswordForm } from '../hooks/useForgotPasswordForm';

export function ForgotPasswordForm() {
    const t = useTranslations('features.auth-password-reset');
    const [state, formAction] = useForgotPasswordForm();
    if (state.submitted) {
        return (
            <div
                role="status"
                aria-live="polite"
                className="space-y-2 rounded-md border border-secondary-800 bg-secondary-900/60 p-4 text-sm"
            >
                <p className="font-semibold text-secondary-100">
                    {t('ForgotPasswordForm.fe04f2')}
                </p>
                <p className="text-secondary-300">
                    {t('ForgotPasswordForm.3be296')}
                </p>
                <p className="text-secondary-300">
                    {t('ForgotPasswordForm.3e3640')}
                </p>
            </div>
        );
    }
    return (
        <form action={formAction} className="space-y-4" noValidate>
            <AuthFieldGroup
                id="forgot-email"
                name="email"
                label={t('ForgotPasswordForm.3c3776')}
                type="email"
                autoComplete="email"
                required
            />
            <SubmitButton
                label={t('ForgotPasswordForm.f4d6d3')}
                pendingLabel={t('ForgotPasswordForm.8321f5')}
            />
        </form>
    );
}
