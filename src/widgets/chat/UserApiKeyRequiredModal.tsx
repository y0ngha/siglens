'use client';

import { useTranslations } from 'next-intl';
import { useRef, useEffect } from 'react';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { useFocusTrap } from '@/shared/hooks/useFocusTrap';
import { useEscapeKey } from '@/shared/hooks/useEscapeKey';
import type { LlmProvider } from '@y0ngha/siglens-core';

const PROVIDER_DISPLAY: Record<LlmProvider, string> = {
    anthropic: 'Anthropic',
    google: 'Google',
    openai: 'OpenAI',
    deepseek: 'DeepSeek',
};

interface UserApiKeyRequiredModalProps {
    open: boolean;
    onClose: () => void;
    provider: LlmProvider;
    loggedIn: boolean;
    onSwitchToFree: () => void;
}

export function UserApiKeyRequiredModal({
    open,
    onClose,
    provider,
    loggedIn,
    onSwitchToFree,
}: UserApiKeyRequiredModalProps) {
    const t = useTranslations('widgets.chat');
    const dialogRef = useRef<HTMLDivElement>(null);

    useFocusTrap(dialogRef, open);
    useEscapeKey(onClose, open);

    useEffect(() => {
        if (open) {
            dialogRef.current?.focus();
        }
    }, [open]);

    if (!open) return null;

    // /account 페이지 안에 ApiKeySection이 호스팅되므로 로그인 사용자는 /account로,
    // 비로그인은 /signup으로 보낸다. 이전엔 존재하지 않는 /account/api-keys, /auth/sign-up
    // 경로로 박혀 있어 클릭 시 404가 나는 dead link였다.
    const ctaHref = loggedIn ? '/account' : '/signup';
    const ctaLabel = loggedIn
        ? t('UserApiKeyRequiredModal.e790ae')
        : t('UserApiKeyRequiredModal.16ec45');
    const bodyText = loggedIn
        ? t('UserApiKeyRequiredModal.378180')
        : t('UserApiKeyRequiredModal.017c94');

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-secondary-950/80 p-4 backdrop-blur-sm">
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="api-key-modal-title"
                tabIndex={-1}
                className="w-full max-w-sm rounded-xl border border-secondary-700 bg-secondary-800 shadow-2xl outline-none"
            >
                <div className="flex items-center justify-between border-b border-secondary-700 px-5 py-4">
                    <h2
                        id="api-key-modal-title"
                        className="text-sm font-semibold text-secondary-100"
                    >
                        {t('UserApiKeyRequiredModal.f77cc9', {
                            v0: PROVIDER_DISPLAY[provider],
                        })}
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label={t('UserApiKeyRequiredModal.94b7db')}
                        className="rounded p-1 text-secondary-500 transition-colors hover:text-secondary-300 focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:outline-none"
                    >
                        ✕
                    </button>
                </div>

                <div className="flex flex-col gap-4 px-5 py-4">
                    <p className="text-sm leading-relaxed text-secondary-400">
                        {bodyText}
                    </p>

                    <div className="flex flex-col gap-2">
                        <Link
                            href={ctaHref}
                            onClick={onClose}
                            className="flex h-9 items-center justify-center rounded-lg bg-primary-600 px-4 text-sm font-medium text-secondary-50 transition-colors hover:bg-primary-500 focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:outline-none"
                        >
                            {ctaLabel}
                        </Link>

                        <button
                            type="button"
                            onClick={onSwitchToFree}
                            className="flex h-9 items-center justify-center rounded-lg border border-secondary-700 px-4 text-sm text-secondary-400 transition-colors hover:text-secondary-200 focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:outline-none"
                        >
                            {t('UserApiKeyRequiredModal.f85b06')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
