'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { OAuthProvider, SupportedOAuthProvider } from '@/domain/types';
import { ConsentCheckboxGroup } from '@/components/auth/ConsentCheckboxGroup';
import { AuthErrorAlert } from '@/components/auth/AuthErrorAlert';
import { useFinalizeOAuthSignup } from '@/components/auth/hooks/useFinalizeOAuthSignup';
import { useCancelOAuthSignup } from '@/components/auth/hooks/useCancelOAuthSignup';
import { usePageShowReload } from '@/components/auth/hooks/usePageShowReload';

interface OAuthConsentFormProps {
    token: string;
    provider: SupportedOAuthProvider;
    email: string;
    name?: string;
    avatarUrl?: string;
}

const PROVIDER_LABEL: Partial<Record<OAuthProvider, string>> = {
    google: 'Google',
    kakao: 'Kakao',
};

export function OAuthConsentForm({
    token,
    provider,
    email,
    name,
    avatarUrl,
}: OAuthConsentFormProps) {
    const [privacyChecked, setPrivacyChecked] = useState(false);
    const [tosChecked, setTosChecked] = useState(false);
    const [finalizeState, finalizeFormAction] = useFinalizeOAuthSignup();
    const cancelFormAction = useCancelOAuthSignup();
    usePageShowReload();

    const consentError =
        finalizeState.error?.code === 'consent_required'
            ? finalizeState.error.message
            : undefined;
    const formError =
        finalizeState.error && finalizeState.error.code !== 'consent_required'
            ? finalizeState.error.message
            : undefined;

    return (
        <div className="space-y-6">
            <div className="border-secondary-800 bg-secondary-900/40 flex items-center gap-3 rounded-lg border p-4">
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
                        className="bg-secondary-800 size-8 rounded-full"
                    />
                )}
                <div className="min-w-0 flex-1">
                    <p className="text-secondary-100 truncate font-mono text-sm">
                        {email}
                    </p>
                    {name ? (
                        <p className="text-secondary-300 truncate text-xs">
                            {name}
                        </p>
                    ) : null}
                    <p className="text-secondary-400 text-xs">
                        {PROVIDER_LABEL[provider] ?? provider} 계정으로 가입
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
                {formError ? <AuthErrorAlert message={formError} /> : null}
                <ConsentCheckboxGroup
                    privacyChecked={privacyChecked}
                    tosChecked={tosChecked}
                    onPrivacyChange={setPrivacyChecked}
                    onTosChange={setTosChecked}
                    error={consentError}
                />
                <button
                    type="submit"
                    className="bg-primary-500 hover:bg-primary-400 text-secondary-950 focus-visible:ring-primary-400 focus-visible:ring-offset-secondary-950 inline-flex h-12 w-full items-center justify-center rounded-md text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                    가입 완료
                </button>
            </form>

            <form action={cancelFormAction}>
                <input type="hidden" name="token" value={token} />
                <button
                    type="submit"
                    className="text-secondary-400 hover:text-secondary-200 focus-visible:ring-primary-400 focus-visible:ring-offset-secondary-950 inline-flex h-10 w-full items-center justify-center rounded-md text-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                    취소
                </button>
            </form>
        </div>
    );
}
