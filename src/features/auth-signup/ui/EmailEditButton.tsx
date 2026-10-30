'use client';

import { useTranslations } from 'next-intl';

interface EmailEditButtonProps {
    onClick: () => void;
}

/** 2·3단계의 이메일 옆 「이메일 수정」. 누르면 흐름을 1단계부터 다시 시작한다. */
export function EmailEditButton({ onClick }: EmailEditButtonProps) {
    const t = useTranslations('features.auth-signup');
    return (
        <button
            type="button"
            onClick={onClick}
            className="rounded font-medium text-primary-400 hover:text-primary-300 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-secondary-950 focus-visible:outline-none"
        >
            {t('SignupForm.f38cb1')}
        </button>
    );
}
