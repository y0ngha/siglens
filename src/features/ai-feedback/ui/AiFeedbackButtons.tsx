'use client';

import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { MOBILE_VIEWPORT_MEDIA_QUERY } from '@/shared/config/viewport';
import { cn } from '@/shared/lib/cn';
import { ThumbsDownIcon, ThumbsUpIcon } from '@/shared/ui/StrokeIcons';
import { useAiFeedback } from '../hooks/useAiFeedback';
import { type AiFeedbackTarget, feedbackIdentityKey } from '../model/targets';
import { FeedbackDownPopover } from './FeedbackDownPopover';

interface AiFeedbackButtonsProps {
    readonly target: AiFeedbackTarget;
    /**
     * 평가 상태를 비우는 기준. 없으면 `target`의 식별 맥락(`feedbackIdentityKey`)을 쓴다.
     * 같은 맥락이 새 응답으로 바뀌는 곳(챗의 다시 생성)은 메시지 id를 넘긴다.
     */
    readonly resetKey?: string;
    /** 데스크톱에서 👎 입력창을 펼칠 방향. 기본은 아래. */
    readonly popoverPlacement?: 'below' | 'above';
    readonly className?: string;
}

const ICON_BUTTON =
    'inline-flex size-8 touch-manipulation items-center justify-center rounded text-secondary-400 transition-colors hover:bg-secondary-800 hover:text-secondary-200 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none active:bg-secondary-800 motion-reduce:transition-none';
const ICON_BUTTON_ON =
    'bg-primary-950 text-primary-300 hover:bg-primary-950 hover:text-primary-200';

/**
 * AI 응답 아래에 붙는 조용한 👍/👎. 결과가 바뀌면(`key`) 다시 마운트해 눌러 둔 상태를 비운다 -
 * 이전 결과에 준 평가가 새 결과에 남아 보이면 거짓이다. 끝난 결과에만 둔다(호출부 책임).
 */
export function AiFeedbackButtons({
    target,
    resetKey,
    popoverPlacement = 'below',
    className,
}: AiFeedbackButtonsProps) {
    return (
        <AiFeedbackControls
            key={resetKey ?? feedbackIdentityKey(target)}
            target={target}
            popoverPlacement={popoverPlacement}
            className={className}
        />
    );
}

interface AiFeedbackControlsProps {
    readonly target: AiFeedbackTarget;
    readonly popoverPlacement: 'below' | 'above';
    readonly className?: string;
}

function AiFeedbackControls({
    target,
    popoverPlacement,
    className,
}: AiFeedbackControlsProps) {
    const t = useTranslations('features.ai-feedback');
    // 뷰포트는 👎를 누르는 순간 한 번 읽는다. 결과마다 붙는 버튼이라 `matchMedia` 리스너를 상시 달지 않고,
    // 입력창이 열릴 때 값이 이미 확정돼 있어 PopoverSurface가 포털로 바뀌며 다시 마운트되지도 않는다.
    const [isMobile, setIsMobile] = useState(false);
    const downRef = useRef<HTMLButtonElement>(null);
    const feedback = useAiFeedback(target);
    const isAnswer = target.surface === 'siglens_ai';

    return (
        <div
            role="group"
            aria-label={
                isAnswer
                    ? t('AiFeedbackButtons.groupAnswer')
                    : t('AiFeedbackButtons.groupAnalysis')
            }
            // 확인 문구는 절대 배치라 줄 높이와 옆 요소를 밀지 않는다(CLS 없음).
            className={cn(
                'relative inline-flex items-center gap-0.5',
                className
            )}
        >
            <button
                type="button"
                aria-pressed={feedback.vote === 'up'}
                aria-label={t('AiFeedbackButtons.up')}
                onClick={() => feedback.pick('up')}
                className={cn(
                    ICON_BUTTON,
                    feedback.vote === 'up' && ICON_BUTTON_ON
                )}
            >
                <ThumbsUpIcon />
            </button>
            <button
                ref={downRef}
                type="button"
                aria-pressed={feedback.vote === 'down'}
                aria-haspopup="dialog"
                aria-expanded={feedback.popoverOpen}
                aria-label={t('AiFeedbackButtons.down')}
                onClick={() => {
                    setIsMobile(
                        window.matchMedia(MOBILE_VIEWPORT_MEDIA_QUERY).matches
                    );
                    feedback.pick('down');
                }}
                className={cn(
                    ICON_BUTTON,
                    feedback.vote === 'down' && ICON_BUTTON_ON
                )}
            >
                <ThumbsDownIcon />
            </button>
            {/* 라이브 영역은 늘 마운트하고 안쪽만 바꾼다(내용과 함께 삽입된 영역은 읽히지 않는다).
                `role="status"`는 달지 않는다 - 결과마다 하나씩 붙는 버튼이라, 같은 화면의 다른 status
                영역(재분석 쿨다운 안내 등)과 역할 질의가 겹친다. `aria-live`만으로 읽힌다. */}
            <span
                aria-live="polite"
                className="pointer-events-none absolute top-1/2 left-full ml-2 -translate-y-1/2 text-xs whitespace-nowrap text-secondary-400"
            >
                {feedback.thanks ? t('AiFeedbackButtons.thanks') : ''}
            </span>
            {feedback.popoverOpen && (
                <FeedbackDownPopover
                    triggerRef={downRef}
                    isMobile={isMobile}
                    placement={popoverPlacement}
                    pending={feedback.detailPending}
                    onSend={detail => void feedback.sendDetail(detail)}
                    onClose={feedback.closePopover}
                />
            )}
        </div>
    );
}
