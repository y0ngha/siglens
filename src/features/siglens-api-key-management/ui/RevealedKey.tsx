'use client';

import { useTranslations } from 'next-intl';
import { useCopyToClipboard } from '@/shared/hooks/useCopyToClipboard';
import { BUTTON_GHOST, BUTTON_OUTLINE } from '@/shared/lib/buttonStyles';
import { cn } from '@/shared/lib/cn';

interface RevealedKeyProps {
    rawKey: string;
    onDismiss: () => void;
}

/** 새 키 원문을 한 번만 보여 준다. 서버에는 해시만 남아 다시 읽을 방법이 없다. */
export function RevealedKey({ rawKey, onDismiss }: RevealedKeyProps) {
    const t = useTranslations('features.siglens-api-key-management');
    const { copied, failed, copy } = useCopyToClipboard();
    return (
        <div
            role="status"
            data-testid="siglens-api-key-revealed"
            className="space-y-3 rounded-lg bg-secondary-900/60 p-4 ring-1 ring-primary-500"
        >
            <p className="text-sm font-semibold text-secondary-100">
                {t('SiglensApiKeySection.revealedTitle')}
            </p>
            <code
                data-testid="siglens-api-key-raw"
                className="block rounded-lg border border-border-control bg-secondary-950 px-3 py-2 font-mono text-sm break-all text-secondary-50 select-all"
            >
                {rawKey}
            </code>
            <p className="text-sm text-ui-warning-text">
                {t('SiglensApiKeySection.revealedWarning')}
            </p>
            <div className="flex flex-wrap items-center gap-2">
                <button
                    type="button"
                    onClick={() => void copy(rawKey)}
                    className={cn(BUTTON_OUTLINE, 'h-9 px-3 text-sm')}
                >
                    {copied
                        ? t('SiglensApiKeySection.copied')
                        : t('SiglensApiKeySection.copy')}
                </button>
                <button
                    type="button"
                    onClick={onDismiss}
                    className={cn(BUTTON_GHOST, 'h-9 px-3 text-sm')}
                >
                    {t('SiglensApiKeySection.dismiss')}
                </button>
                {failed && (
                    <span role="alert" className="text-sm text-ui-danger-text">
                        {t('SiglensApiKeySection.copyFailed')}
                    </span>
                )}
            </div>
        </div>
    );
}
