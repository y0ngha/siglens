'use client';

import { useTranslations } from 'next-intl';
import { useEscapeKey } from '@/shared/hooks/useEscapeKey';
import { useFocusTrap } from '@/shared/hooks/useFocusTrap';
import type { GateMode } from '@/entities/api-key';
import { cn } from '@/shared/lib/cn';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { useEffect, useRef } from 'react';

interface PremiumModelGateModalProps {
    mode: GateMode;
    providerLabel?: string;
    onClose: () => void;
}

const TITLE_ID = 'premium-model-gate-title';

export function PremiumModelGateModal({
    mode,
    providerLabel,
    onClose,
}: PremiumModelGateModalProps) {
    const t = useTranslations('features.premium-gate');
    const tMisc = useTranslations('shared.ui.misc');
    const panelRef = useRef<HTMLDivElement>(null);

    useFocusTrap(panelRef, true);
    useEscapeKey(onClose, true);

    useEffect(() => {
        panelRef.current?.focus();
    }, []);

    const isAuth = mode === 'auth';
    const iconColorClass = isAuth
        ? 'text-ui-warning-text'
        : 'text-ui-success-text';
    const title = isAuth
        ? t('PremiumModelGateModal.2d4880')
        : t('PremiumModelGateModal.2f2f6d');
    const body = isAuth
        ? t('PremiumModelGateModal.671fa2')
        : tMisc('byokUnlock', { v0: providerLabel ?? '' });

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            aria-modal="true"
        >
            {/* backdrop */}
            <div
                className="absolute inset-0 bg-secondary-950/80 backdrop-blur-sm"
                onClick={onClose}
                aria-hidden="true"
            />

            <div
                ref={panelRef}
                role="dialog"
                aria-labelledby={TITLE_ID}
                tabIndex={-1}
                className="relative w-full max-w-sm rounded-lg bg-secondary-900 p-6 shadow-2xl ring-1 ring-secondary-700 outline-none"
            >
                <div className="mb-4 flex flex-col items-center gap-3 text-center">
                    {/* inline SVG avoids lucide-react dependency */}
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={cn('h-8 w-8', iconColorClass)}
                        aria-hidden="true"
                    >
                        <rect
                            x="3"
                            y="11"
                            width="18"
                            height="11"
                            rx="2"
                            ry="2"
                        />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    <h2
                        id={TITLE_ID}
                        className="font-semibold text-secondary-50"
                    >
                        {title}
                    </h2>
                    <p className="text-sm leading-relaxed text-secondary-300">
                        {body}
                    </p>
                </div>

                <div className="flex flex-col gap-2">
                    {isAuth ? (
                        <Link
                            href="/signup"
                            onClick={onClose}
                            className="flex h-10 items-center justify-center rounded-lg bg-primary-600 px-4 text-sm font-medium text-white transition-colors hover:bg-primary-500 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                        >
                            {t('PremiumModelGateModal.2b8afd')}
                        </Link>
                    ) : (
                        <Link
                            href="/account"
                            onClick={onClose}
                            className="flex h-10 items-center justify-center rounded-lg bg-primary-600 px-4 text-sm font-medium text-white transition-colors hover:bg-primary-500 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                        >
                            {t('PremiumModelGateModal.e91c23')}
                        </Link>
                    )}
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-10 items-center justify-center rounded-lg px-4 text-sm text-secondary-400 transition-colors hover:text-secondary-200 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                    >
                        {t('PremiumModelGateModal.94b7db')}
                    </button>
                </div>
            </div>
        </div>
    );
}
