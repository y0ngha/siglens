'use client';

import { useTranslations } from 'next-intl';
import { BUTTON_OUTLINE, BUTTON_PRIMARY } from '@/shared/lib/buttonStyles';
import { cn } from '@/shared/lib/cn';
import { ModalShell } from '@/shared/ui/ModalShell';
import { Spinner } from '@/shared/ui/Spinner';
import { CloseIcon } from '@/shared/ui/StrokeIcons';
import {
    SHARE_MODAL_ACTION_SIZE,
    SHARE_MODAL_CLOSE_BUTTON,
    SHARE_MODAL_OUTLINE_HOVER,
    SHARE_MODAL_PANEL,
} from './modalStyles';

const TITLE_ID = 'share-preparing-modal-title';

interface SharePreparingModalProps {
    open: boolean;
    phase: 'pending' | 'error';
    onClose: () => void;
    onRetry: () => void;
}

/**
 * Modal shown while an analysis is being prepared for sharing.
 *
 * - pending: full-screen-centered spinner + aria-live status text + sub-hint.
 * - error: error message + retry + close buttons.
 *
 * Built on ModalShell (same shell as ShareTriggerDialog).
 * aria-busy="true" during pending so screen readers announce the live region.
 */
export function SharePreparingModal({
    open,
    phase,
    onClose,
    onRetry,
}: SharePreparingModalProps) {
    const t = useTranslations('widgets.share');

    if (!open) return null;

    return (
        <ModalShell
            titleId={TITLE_ID}
            onClose={onClose}
            busy={phase === 'pending'}
            className={SHARE_MODAL_PANEL}
        >
            <div className="flex items-center justify-between border-b border-secondary-700 px-5 py-4">
                <h2
                    id={TITLE_ID}
                    className="text-sm font-semibold text-secondary-100"
                >
                    {phase === 'pending'
                        ? t('SharePreparingModal.797416')
                        : t('SharePreparingModal.15b661')}
                </h2>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label={t('SharePreparingModal.94b7db')}
                    className={SHARE_MODAL_CLOSE_BUTTON}
                >
                    <CloseIcon />
                </button>
            </div>

            <div className="flex flex-col items-center gap-4 px-5 py-6">
                {phase === 'pending' ? (
                    <>
                        <Spinner size="xl" />
                        <div
                            aria-live="polite"
                            className="flex flex-col items-center gap-1 text-center"
                        >
                            <p className="text-sm text-secondary-200">
                                {t('SharePreparingModal.cec483')}
                            </p>
                            <p className="text-xs text-secondary-500">
                                {t('SharePreparingModal.99d27b')}
                            </p>
                        </div>
                    </>
                ) : (
                    <>
                        <p className="text-center text-sm text-secondary-300">
                            {t('SharePreparingModal.98580d')}
                        </p>
                        <div className="flex w-full flex-col gap-2">
                            <button
                                type="button"
                                onClick={onRetry}
                                className={cn(
                                    BUTTON_PRIMARY,
                                    SHARE_MODAL_ACTION_SIZE
                                )}
                            >
                                {t('SharePreparingModal.0c767c')}
                            </button>
                            <button
                                type="button"
                                onClick={onClose}
                                className={cn(
                                    BUTTON_OUTLINE,
                                    SHARE_MODAL_ACTION_SIZE,
                                    SHARE_MODAL_OUTLINE_HOVER
                                )}
                            >
                                {t('SharePreparingModal.94b7db')}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </ModalShell>
    );
}
