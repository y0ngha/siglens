'use client';

import { useTranslations } from 'next-intl';
import { useShareFlow } from '@/features/share';
import { cn } from '@/shared/lib/cn';
import { ShareSheet } from './ShareSheet';
import { ShareTriggerDialog } from './ShareTriggerDialog';
import { SharePreparingModal } from './SharePreparingModal';
import { ShareIcon, SpinnerIcon } from './icons';

/**
 * Header button that orchestrates the share flow for the current analysis tab.
 *
 * All state-machine logic (mutation, auto-advance, native-share vs sheet branching,
 * sheet/dialog/preparing state) lives in useShareFlow() from @/features/share.
 * This component is purely presentational: it reads the hook's return value and
 * renders the appropriate UI elements.
 */
export function ShareButton() {
    const t = useTranslations('widgets.share');
    const {
        isMutating,
        sheetOpen,
        triggerDialogOpen,
        preparingOpen,
        preparingPhase,
        unavailableVisible,
        shareUrl,
        tweetText,
        describedById,
        symbol,
        buttonRef,
        onClick,
        onTriggerConfirm,
        onTriggerCancel,
        onPreparingClose,
        onPreparingRetry,
        onSheetClose,
    } = useShareFlow();

    return (
        <div className="relative">
            <button
                ref={buttonRef}
                type="button"
                aria-label={t('ShareButton.281cf1')}
                aria-busy={isMutating ? 'true' : undefined}
                aria-describedby={
                    unavailableVisible ? describedById : undefined
                }
                disabled={isMutating}
                onClick={onClick}
                className={cn(
                    'border-secondary-700 text-secondary-300 inline-flex size-11 items-center justify-center rounded-lg border',
                    'hover:border-secondary-600 hover:bg-secondary-700/30 hover:text-secondary-100',
                    'focus-visible:ring-primary-500 focus-visible:ring-2 focus-visible:outline-none',
                    'touch-manipulation transition-colors'
                )}
            >
                {isMutating ? (
                    <SpinnerIcon className="h-5 w-5" />
                ) : (
                    <ShareIcon className="h-5 w-5" />
                )}
            </button>

            {unavailableVisible && (
                <p
                    id={describedById}
                    role="status"
                    className="absolute top-full right-0 z-50 mt-1 w-max max-w-xs rounded-lg border border-secondary-700 bg-secondary-900 px-3 py-2 text-xs text-secondary-400 shadow-lg"
                >
                    {t('ShareButton.30b27f')}
                </p>
            )}

            {sheetOpen && shareUrl && (
                <ShareSheet
                    shareUrl={shareUrl}
                    tweetText={tweetText}
                    title={`${symbol} AI 분석 결과`}
                    description={tweetText}
                    onClose={onSheetClose}
                />
            )}

            <ShareTriggerDialog
                open={triggerDialogOpen}
                onConfirm={onTriggerConfirm}
                onCancel={onTriggerCancel}
            />

            <SharePreparingModal
                open={preparingOpen}
                phase={preparingPhase}
                onClose={onPreparingClose}
                onRetry={onPreparingRetry}
            />
        </div>
    );
}
