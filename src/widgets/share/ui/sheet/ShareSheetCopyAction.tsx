'use client';

/** 공유 시트의 링크 복사 행 — 복사 결과 안내와, 클립보드가 막혔을 때의 직접 복사 입력. */

import type { RefObject } from 'react';
import { useTranslations } from 'next-intl';
import { CheckIcon, LinkIcon } from '@/shared/ui/StrokeIcons';
import { SHARE_SHEET_ROW } from '../../utils/sheetStyles';
import {
    focusAndSelectInput,
    selectInputOnClick,
} from '../../utils/selectInputText';

interface ShareSheetCopyActionProps {
    /** 시트가 열릴 때 포커스를 받는 버튼 ref. */
    buttonRef: RefObject<HTMLButtonElement | null>;
    shareUrl: string;
    copied: boolean;
    copyFailed: boolean;
    onCopy: () => Promise<void>;
}

/** 링크 복사 버튼과 복사 실패 시의 읽기 전용 링크 입력. */
export function ShareSheetCopyAction({
    buttonRef,
    shareUrl,
    copied,
    copyFailed,
    onCopy,
}: ShareSheetCopyActionProps) {
    const t = useTranslations('widgets.share');
    const label = copied ? t('ShareSheet.e5c85b') : t('ShareSheet.01660a');

    return (
        <>
            <div aria-live="polite" className="sr-only">
                {copied ? t('ShareSheet.c040b8') : ''}
            </div>

            <button
                ref={buttonRef}
                type="button"
                onClick={onCopy}
                className={SHARE_SHEET_ROW}
            >
                {copied ? (
                    <CheckIcon className="size-5 text-primary-300" />
                ) : (
                    <LinkIcon className="size-5" />
                )}
                <span>{label}</span>
            </button>

            {copyFailed && (
                <div className="px-3 py-2">
                    <input
                        ref={focusAndSelectInput}
                        type="text"
                        readOnly
                        value={shareUrl}
                        className="w-full rounded border border-border-control bg-secondary-800 px-2 py-1 text-xs text-secondary-200"
                        onClick={selectInputOnClick}
                        aria-label={t('ShareSheet.e4441b')}
                    />
                </div>
            )}
        </>
    );
}
