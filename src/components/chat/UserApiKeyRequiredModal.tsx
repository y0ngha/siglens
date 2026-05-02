'use client';

import { useRef, useEffect } from 'react';
import Link from 'next/link';
import { useFocusTrap } from '@/components/hooks/useFocusTrap';
import { useEscapeKey } from '@/components/hooks/useEscapeKey';
import { cn } from '@/lib/cn';
import type { LlmProvider } from '@y0ngha/siglens-core';

const PROVIDER_DISPLAY: Record<LlmProvider, string> = {
    anthropic: 'Anthropic',
    google: 'Google',
    openai: 'OpenAI',
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
    const dialogRef = useRef<HTMLDivElement>(null);

    useFocusTrap(dialogRef, open);
    useEscapeKey(onClose, open);

    useEffect(() => {
        if (open) {
            dialogRef.current?.focus();
        }
    }, [open]);

    if (!open) return null;

    const ctaHref = loggedIn ? '/account/api-keys' : '/auth/sign-up';
    const ctaLabel = loggedIn ? 'API 키 등록하기' : '회원가입하기';
    const bodyText = loggedIn
        ? 'API 키를 등록하면 이 모델을 사용할 수 있어요.'
        : '회원가입하고 본인의 API 키를 등록하면 이 모델을 사용할 수 있어요.';

    return (
        <div
            className="bg-secondary-950/80 fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
            aria-hidden="true"
        >
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="api-key-modal-title"
                tabIndex={-1}
                className={cn(
                    'border-secondary-700 bg-secondary-800 w-full max-w-sm rounded-xl border shadow-2xl outline-none'
                )}
            >
                <div className="border-secondary-700 flex items-center justify-between border-b px-5 py-4">
                    <h2
                        id="api-key-modal-title"
                        className="text-secondary-100 text-sm font-semibold"
                    >
                        {PROVIDER_DISPLAY[provider]} API 키가 필요해요
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="닫기"
                        className="text-secondary-500 hover:text-secondary-300 focus-visible:ring-primary-500 rounded p-1 transition-colors focus-visible:ring-1 focus-visible:outline-none"
                    >
                        ✕
                    </button>
                </div>

                <div className="flex flex-col gap-4 px-5 py-4">
                    <p className="text-secondary-400 text-sm leading-relaxed">
                        {bodyText}
                    </p>

                    <div className="flex flex-col gap-2">
                        <Link
                            href={ctaHref}
                            onClick={onClose}
                            className="bg-primary-600 hover:bg-primary-500 focus-visible:ring-primary-500 flex h-9 items-center justify-center rounded-lg px-4 text-sm font-medium text-white transition-colors focus-visible:ring-1 focus-visible:outline-none"
                        >
                            {ctaLabel}
                        </Link>

                        <button
                            type="button"
                            onClick={onSwitchToFree}
                            className="text-secondary-400 hover:text-secondary-200 focus-visible:ring-primary-500 border-secondary-700 flex h-9 items-center justify-center rounded-lg border px-4 text-sm transition-colors focus-visible:ring-1 focus-visible:outline-none"
                        >
                            무료 모델로 계속하기
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
