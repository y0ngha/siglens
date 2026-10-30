'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useCopyToClipboard } from '@/shared/hooks/useCopyToClipboard';
import { BUTTON_GHOST, BUTTON_OUTLINE } from '@/shared/lib/buttonStyles';
import { cn } from '@/shared/lib/cn';

interface RevealedKeyProps {
    /** 방금 발급한 키 원문. 이 화면 밖으로 내보내지 않는다(복사는 사용자가 누를 때만). */
    rawKey: string;
    /** "보관했어요" — 원문을 화면에서 치운다. 다음 포커스 대상은 부모가 정한다. */
    onDismiss: () => void;
}

/**
 * 새 키 원문을 한 번만 보여 준다. 서버에는 해시만 남아 다시 읽을 방법이 없다.
 *
 * 마운트되면(= 새 키를 막 만들었다) 패널로 포커스를 옮긴다. 패널과 내용이 한꺼번에 삽입돼
 * 라이브 영역만으로는 보조기술이 읽지 않을 수 있고, 다음 할 일(복사)도 이 안에 있다.
 * 부모는 원문마다 `key`를 달아 새 키가 오면 다시 마운트한다.
 */
export function RevealedKey({ rawKey, onDismiss }: RevealedKeyProps) {
    const t = useTranslations('features.siglens-api-key-management');
    const panelRef = useRef<HTMLDivElement>(null);
    const { copied, failed, copy } = useCopyToClipboard();

    useEffect(() => {
        panelRef.current?.focus();
    }, []);

    return (
        <div
            ref={panelRef}
            tabIndex={-1}
            role="status"
            data-testid="siglens-api-key-revealed"
            className="space-y-3 rounded-lg bg-secondary-900/60 p-4 ring-1 ring-primary-500 focus:outline-none"
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
