'use client';

import { useTranslations } from 'next-intl';
import { type RefObject, useId, useRef, useState } from 'react';
import {
    DOWN_COMMENT_MAX_LENGTH,
    FEEDBACK_DOWN_REASONS,
    type FeedbackDownReason,
} from '@/entities/feedback/types';
import { useEscapeKey } from '@/shared/hooks/useEscapeKey';
import { useFocusTrap } from '@/shared/hooks/useFocusTrap';
import { useOnClickOutside } from '@/shared/hooks/useOnClickOutside';
import { BUTTON_GHOST, BUTTON_PRIMARY } from '@/shared/lib/buttonStyles';
import { cn } from '@/shared/lib/cn';
import { PopoverSurface } from '@/shared/ui/PopoverSurface';
import type { DownDetail } from '../hooks/useAiFeedback';

const CHIP_BASE =
    'inline-flex min-h-8 touch-manipulation items-center rounded-full border px-3 text-xs transition-colors focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none motion-reduce:transition-none';
const CHIP_OFF =
    'border-border-control text-secondary-200 hover:bg-secondary-700/50';
const CHIP_ON = 'border-primary-600 bg-primary-600 text-white';

interface FeedbackDownPopoverProps {
    readonly triggerRef: RefObject<HTMLButtonElement | null>;
    readonly isMobile: boolean;
    /** 데스크톱에서 트리거 위/아래 어느 쪽으로 펼칠지. 화면 아래에 붙은 줄(챗)은 위로 연다. */
    readonly placement: 'below' | 'above';
    readonly pending: boolean;
    readonly onSend: (detail: DownDetail) => void;
    readonly onClose: () => void;
}

/**
 * 👎를 누른 직후 열리는 작은 입력창 - 사유 칩(여러 개)과 선택 한 줄 의견. 👎 자체는 이미 저장돼 있어
 * 닫아도 평가는 남는다. 칩을 꼭 골라야 보낼 수 있게 막지 않는다: 의견만 적어도, 아무것도 안 적고 닫아도 된다.
 */
export function FeedbackDownPopover({
    triggerRef,
    isMobile,
    placement,
    pending,
    onSend,
    onClose,
}: FeedbackDownPopoverProps) {
    const t = useTranslations('features.ai-feedback');
    const titleId = useId();
    const commentId = useId();
    const panelRef = useRef<HTMLDivElement>(null);
    const [reasons, setReasons] = useState<readonly FeedbackDownReason[]>([]);
    const [comment, setComment] = useState('');

    useFocusTrap(panelRef, true, isMobile);
    useEscapeKey(onClose, true);
    useOnClickOutside([panelRef, triggerRef], onClose);

    // 키를 리터럴로 직접 부른다 - 레코드로 한 번 거치면 추출기가 키를 못 읽어 카탈로그에서 지운다(I18-16).
    const reasonLabel = (reason: FeedbackDownReason): string => {
        switch (reason) {
            case 'inaccurate':
                return t('FeedbackDownPopover.reasonInaccurate');
            case 'unsupported':
                return t('FeedbackDownPopover.reasonUnsupported');
            case 'off_topic':
                return t('FeedbackDownPopover.reasonOffTopic');
            case 'too_long':
                return t('FeedbackDownPopover.reasonTooLong');
            case 'other':
                return t('FeedbackDownPopover.reasonOther');
        }
    };

    const toggle = (reason: FeedbackDownReason): void =>
        setReasons(prev =>
            prev.includes(reason)
                ? prev.filter(r => r !== reason)
                : [...prev, reason]
        );

    return (
        <PopoverSurface
            isMobile={isMobile}
            dialogRef={panelRef}
            titleId={titleId}
            desktopClassName={
                placement === 'above'
                    ? 'left-0 right-auto bottom-full top-auto mb-2'
                    : 'left-0 right-auto mt-2'
            }
            className="overscroll-contain rounded-lg border border-secondary-700 bg-secondary-900 p-4 text-left shadow-2xl outline-none motion-safe:animate-[fade-in_150ms_ease-out]"
        >
            <h2
                id={titleId}
                className="mb-3 text-sm font-semibold text-secondary-100"
            >
                {t('FeedbackDownPopover.title')}
            </h2>
            <div className="mb-3 flex flex-wrap gap-2">
                {FEEDBACK_DOWN_REASONS.map(reason => (
                    <button
                        key={reason}
                        type="button"
                        aria-pressed={reasons.includes(reason)}
                        onClick={() => toggle(reason)}
                        className={cn(
                            CHIP_BASE,
                            reasons.includes(reason) ? CHIP_ON : CHIP_OFF
                        )}
                    >
                        {reasonLabel(reason)}
                    </button>
                ))}
            </div>
            <label
                htmlFor={commentId}
                className="mb-1 block text-xs text-secondary-400"
            >
                {t('FeedbackDownPopover.commentLabel')}
            </label>
            <input
                id={commentId}
                type="text"
                value={comment}
                maxLength={DOWN_COMMENT_MAX_LENGTH}
                onChange={event => setComment(event.target.value)}
                autoComplete="off"
                className="mb-3 h-9 w-full rounded-lg border border-border-control bg-secondary-800 px-3 text-base text-secondary-100 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none sm:text-sm"
            />
            <div className="flex gap-2">
                <button
                    type="button"
                    // 진행 중에 포커스가 body로 떨어져 트랩이 풀리지 않도록 disabled 대신 aria-disabled.
                    aria-disabled={pending}
                    onClick={() => {
                        if (!pending) onSend({ reasons, comment });
                    }}
                    className={cn(
                        BUTTON_PRIMARY,
                        'h-9 flex-1 px-4 text-sm',
                        'aria-disabled:cursor-not-allowed aria-disabled:bg-secondary-700 aria-disabled:text-secondary-500'
                    )}
                >
                    {t('FeedbackDownPopover.send')}
                </button>
                <button
                    type="button"
                    onClick={onClose}
                    className={cn(BUTTON_GHOST, 'h-9 px-3 text-sm')}
                >
                    {t('FeedbackDownPopover.close')}
                </button>
            </div>
        </PopoverSurface>
    );
}
