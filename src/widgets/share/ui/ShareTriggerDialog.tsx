'use client';

import { useTranslations } from 'next-intl';
import { BUTTON_OUTLINE, BUTTON_PRIMARY } from '@/shared/lib/buttonStyles';
import { cn } from '@/shared/lib/cn';
import { ModalShell } from '@/shared/ui/ModalShell';
import { CloseIcon } from '@/shared/ui/StrokeIcons';
import {
    SHARE_MODAL_ACTION_SIZE,
    SHARE_MODAL_CLOSE_BUTTON,
    SHARE_MODAL_OUTLINE_HOVER,
    SHARE_MODAL_PANEL,
} from './modalStyles';

const TITLE_ID = 'share-trigger-dialog-title';

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
 * ModalShell supplies the focus trap (initial focus + Tab wrap + trigger restore),
 * Escape and backdrop-click dismissal.
 * Default focus lands on the primary CTA so a single Enter confirms.
 */
export function ShareTriggerDialog({
    open,
    onConfirm,
    onCancel,
}: ShareTriggerDialogProps) {
    const t = useTranslations('widgets.share');

    if (!open) return null;

    return (
        <ModalShell
            titleId={TITLE_ID}
            onClose={onCancel}
            className={SHARE_MODAL_PANEL}
        >
            <div className="flex items-center justify-between border-b border-secondary-700 px-5 py-4">
                <h2
                    id={TITLE_ID}
                    className="text-sm font-semibold text-secondary-100"
                >
                    {t('ShareTriggerDialog.5481d6')}
                </h2>
                <button
                    type="button"
                    aria-label={t('ShareTriggerDialog.94b7db')}
                    onClick={onCancel}
                    className={SHARE_MODAL_CLOSE_BUTTON}
                >
                    <CloseIcon />
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
                        className={cn(BUTTON_PRIMARY, SHARE_MODAL_ACTION_SIZE)}
                    >
                        {t('ShareTriggerDialog.cc6aae')}
                    </button>

                    <button
                        type="button"
                        onClick={onCancel}
                        className={cn(
                            BUTTON_OUTLINE,
                            SHARE_MODAL_ACTION_SIZE,
                            SHARE_MODAL_OUTLINE_HOVER
                        )}
                    >
                        {t('ShareTriggerDialog.2d4e13')}
                    </button>
                </div>
            </div>
        </ModalShell>
    );
}
