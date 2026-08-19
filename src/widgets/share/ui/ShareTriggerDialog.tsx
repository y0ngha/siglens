'use client';

import { useTranslations } from 'next-intl';
import { useRef } from 'react';
import { useFocusTrap } from '@/shared/hooks/useFocusTrap';
import { useEscapeKey } from '@/shared/hooks/useEscapeKey';

interface ShareTriggerDialogProps {
    open: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

/**
 * Confirmation dialog shown when the user clicks Share but no analysis result
 * is ready yet. Explains that an analysis will be triggered first, then the
 * share sheet will open automatically.
 *
 * Mirrors the UserApiKeyRequiredModal pattern:
 * useFocusTrap (initial focus + Tab wrap + trigger restore) + useEscapeKey.
 * Default focus lands on the primary CTA so a single Enter confirms.
 */
export function ShareTriggerDialog({
    open,
    onConfirm,
    onCancel,
}: ShareTriggerDialogProps) {
    const t = useTranslations('widgets.share');
    const dialogRef = useRef<HTMLDivElement>(null);

    useFocusTrap(dialogRef, open);
    useEscapeKey(onCancel, open);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-secondary-950/80 p-4 backdrop-blur-sm">
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="share-trigger-dialog-title"
                tabIndex={-1}
                className="w-full max-w-sm rounded-xl border border-secondary-700 bg-secondary-800 shadow-2xl outline-none"
            >
                <div className="flex items-center justify-between border-b border-secondary-700 px-5 py-4">
                    <h2
                        id="share-trigger-dialog-title"
                        className="text-sm font-semibold text-secondary-100"
                    >
                        {t('ShareTriggerDialog.5481d6')}
                    </h2>
                    <button
                        type="button"
                        aria-label={t('ShareTriggerDialog.94b7db')}
                        onClick={onCancel}
                        className="-mr-1 rounded p-1 text-secondary-400 transition-colors hover:text-secondary-200 focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:outline-none"
                    >
                        ✕
                    </button>
                </div>

                <div className="flex flex-col gap-4 px-5 py-4">
                    <p className="text-sm leading-relaxed text-secondary-400">
                        {t('ShareTriggerDialog.b74ea2')}
                    </p>

                    <div className="flex flex-col gap-2">
                        <button
                            type="button"
                            onClick={onConfirm}
                            className="flex h-9 touch-manipulation items-center justify-center rounded-lg bg-primary-600 px-4 text-sm font-medium text-secondary-50 transition-colors hover:bg-primary-500 focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:outline-none"
                        >
                            {t('ShareTriggerDialog.cc6aae')}
                        </button>

                        <button
                            type="button"
                            onClick={onCancel}
                            className="flex h-9 touch-manipulation items-center justify-center rounded-lg border border-secondary-700 px-4 text-sm text-secondary-400 transition-colors hover:text-secondary-200 focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:outline-none"
                        >
                            {t('ShareTriggerDialog.2d4e13')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
