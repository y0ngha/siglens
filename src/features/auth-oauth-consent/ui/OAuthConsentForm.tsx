'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import Image from 'next/image';
import type { OAuthProvider, SupportedOAuthProvider } from '@/shared/lib/types';
import { ConsentCheckboxGroup } from '@/shared/ui/auth/ConsentCheckboxGroup';
import { SubmitButton } from '@/shared/ui/auth/SubmitButton';
import { BUTTON_GHOST } from '@/shared/lib/buttonStyles';
import { cn } from '@/shared/lib/cn';
import { AUTH_ERROR_KEY } from '@/shared/lib/authErrorKey';
import { useFinalizeOAuthSignup } from '../hooks/useFinalizeOAuthSignup';
import { usePageShowReload } from '@/shared/hooks/usePageShowReload';

interface OAuthConsentFormProps {
    token: string;
    provider: SupportedOAuthProvider;
    email: string;
    name?: string;
    avatarUrl?: string;
    cancelAction: (formData: FormData) => Promise<void>;
}

const PROVIDER_LABEL: Partial<Record<OAuthProvider, string>> = {
    google: 'Google',
};

export function OAuthConsentForm({
    token,
    provider,
    email,
    name,
    avatarUrl,
    cancelAction,
}: OAuthConsentFormProps) {
    const t = useTranslations('features.auth-oauth-consent');
    const tAuth = useTranslations('entities.auth');
    const [privacyChecked, setPrivacyChecked] = useState(false);
    const [tosChecked, setTosChecked] = useState(false);
    const [finalizeState, finalizeFormAction] = useFinalizeOAuthSignup();
    usePageShowReload();

    // 액션의 `message`는 로그·폴백용 한국어 원문이다(`AUTH_ERROR_KEY` 주석 참고) —
    // 그대로 띄우면 모든 로케일에 한국어가 나간다. 표시는 코드로 번역한다.
    const consentError =
        finalizeState.error?.code === 'consent_required'
            ? tAuth(AUTH_ERROR_KEY.consent_required)
            : undefined;

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3 rounded-lg border border-secondary-700 bg-secondary-900/40 p-4">
                {avatarUrl ? (
                    <Image
                        src={avatarUrl}
                        alt=""
                        width={32}
                        height={32}
                        className="rounded-full"
                    />
                ) : (
                    <div
                        aria-hidden="true"
                        className="size-8 rounded-full bg-secondary-800"
                    />
                )}
                <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-sm text-secondary-100">
                        {email}
                    </p>
                    {name ? (
                        <p className="truncate text-xs text-secondary-300">
                            {name}
                        </p>
                    ) : null}
                    <p className="text-xs text-secondary-400">
                        {PROVIDER_LABEL[provider] ?? provider}{' '}
                        {t('OAuthConsentForm.ecb738')}
                    </p>
                </div>
            </div>

            <form action={finalizeFormAction} className="space-y-4" noValidate>
                <input type="hidden" name="token" value={token} />
                <input
                    type="hidden"
                    name="agreed_privacy"
                    value={privacyChecked ? 'true' : 'false'}
                />
                <input
                    type="hidden"
                    name="agreed_tos"
                    value={tosChecked ? 'true' : 'false'}
                />
                <ConsentCheckboxGroup
                    privacyChecked={privacyChecked}
                    tosChecked={tosChecked}
                    onPrivacyChange={setPrivacyChecked}
                    onTosChange={setTosChecked}
                    error={consentError}
                />
                <SubmitButton
                    label={t('OAuthConsentForm.6615ab')}
                    pendingLabel={t('OAuthConsentForm.e6e1a2')}
                />
            </form>

            <form action={cancelAction}>
                <input type="hidden" name="token" value={token} />
                <button
                    type="submit"
                    className={cn(BUTTON_GHOST, 'h-10 w-full text-sm')}
                >
                    {t('OAuthConsentForm.19b2d1')}
                </button>
            </form>
        </div>
    );
}
