'use client';

import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import type { SupportedOAuthProvider } from '@/shared/lib/types';
import { ConsentCheckboxGroup } from '@/shared/ui/auth/ConsentCheckboxGroup';
import { SubmitButton } from '@/shared/ui/auth/SubmitButton';
import { BUTTON_GHOST } from '@/shared/lib/buttonStyles';
import { cn } from '@/shared/lib/cn';
import { AUTH_ERROR_KEY } from '@/shared/lib/authErrorKey';
import { usePageShowReload } from '@/shared/hooks/usePageShowReload';
import { useFinalizeOAuthSignup } from '../hooks/useFinalizeOAuthSignup';
import { useFocusInvalidFieldOnError } from '../hooks/useFocusInvalidFieldOnError';
import { CONSENT_AGREED_VALUE } from '../lib/readConsentForm';
import { OAuthAccountCard } from './OAuthAccountCard';

interface OAuthConsentFormProps {
    /** 대기 중인 OAuth 가입 토큰 — 가입·취소 두 폼이 함께 실어 보낸다. */
    token: string;
    provider: SupportedOAuthProvider;
    email: string;
    name?: string;
    avatarUrl?: string;
    /** 대기 가입을 지우고 로그인 화면으로 돌려보내는 Server Action(페이지가 주입). */
    cancelAction: (formData: FormData) => Promise<void>;
}

/**
 * OAuth 신규 가입의 약관 동의 화면 — 계정 요약, 필수 약관 동의 후 "가입 완료",
 * 그리고 별도 폼의 "취소". 체크박스 상태는 숨은 입력으로 액션에 실어 보낸다.
 */
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
    const finalizeFormRef = useRef<HTMLFormElement>(null);
    usePageShowReload();
    useFocusInvalidFieldOnError(finalizeFormRef, finalizeState.error);

    // 액션의 `message`는 로그·폴백용 한국어 원문이다(`AUTH_ERROR_KEY` 주석 참고) —
    // 그대로 띄우면 모든 로케일에 한국어가 나간다. 표시는 코드로 번역한다.
    const consentError =
        finalizeState.error?.code === 'consent_required'
            ? tAuth(AUTH_ERROR_KEY.consent_required)
            : undefined;

    return (
        <div className="space-y-6">
            <OAuthAccountCard
                provider={provider}
                email={email}
                name={name}
                avatarUrl={avatarUrl}
            />

            <form
                ref={finalizeFormRef}
                action={finalizeFormAction}
                className="space-y-4"
                noValidate
            >
                <input type="hidden" name="token" value={token} />
                <input
                    type="hidden"
                    name="agreed_privacy"
                    value={privacyChecked ? CONSENT_AGREED_VALUE : 'false'}
                />
                <input
                    type="hidden"
                    name="agreed_tos"
                    value={tosChecked ? CONSENT_AGREED_VALUE : 'false'}
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
