'use client';

import { useTranslations } from 'next-intl';
import {
    type KeyboardEvent,
    useEffect,
    useEffectEvent,
    useId,
    useRef,
    useState,
} from 'react';
import {
    VOC_COMMENT_MAX_LENGTH,
    VOC_RATING_MAX,
    VOC_RATING_MIN,
    type VocTrigger,
} from '@/entities/feedback/types';
import { BUTTON_GHOST, BUTTON_PRIMARY } from '@/shared/lib/buttonStyles';
import { cn } from '@/shared/lib/cn';
import { ModalShell } from '@/shared/ui/ModalShell';
import { CheckIcon, StarIcon } from '@/shared/ui/StrokeIcons';
import { useVocSubmit } from '../hooks/useVocSubmit';

interface VocPromptModalProps {
    readonly trigger: VocTrigger;
    readonly onClose: () => void;
}

/** 성공 문구를 읽을 시간. 길게 붙잡지 않는다. */
const SUCCESS_CLOSE_MS = 1800;
const STARS = Array.from(
    { length: VOC_RATING_MAX - VOC_RATING_MIN + 1 },
    (_, i) => VOC_RATING_MIN + i
);
const ACTION_SIZE = 'h-10 px-4 text-sm';

/**
 * 첫 AI 경험 직후 한 번 뜨는 별점(1~5) + 선택 의견 모달. 띄운 순간 이미 "다시 안 뜸"이 기록돼
 * 있어(호스트) 닫기만 해도 끝이다. 별점을 골라야 보낼 수 있고, 의견은 비워도 된다.
 *
 * 별은 radiogroup이다: 화살표 키로 고르고(고르는 즉시 선택), Tab으로는 그룹에 한 번만 들어간다.
 * hover/포커스 중인 별까지 미리 채워 보여 주되, 선택값은 눌렀을 때만 바뀐다.
 */
export function VocPromptModal({ trigger, onClose }: VocPromptModalProps) {
    const t = useTranslations('features.voc-prompt');
    const titleId = useId();
    const descriptionId = useId();
    const commentId = useId();
    const [rating, setRating] = useState<number | null>(null);
    const [hovered, setHovered] = useState<number | null>(null);
    const [comment, setComment] = useState('');
    const starRefs = useRef<(HTMLButtonElement | null)[]>([]);
    const { status, submit } = useVocSubmit(trigger);

    // 호스트가 인라인 함수를 넘겨도 리렌더로 닫힘 타이머가 다시 시작되지 않게 한다.
    const closeAfterThanks = useEffectEvent(onClose);
    useEffect(() => {
        if (status !== 'sent') return;
        const handle = setTimeout(closeAfterThanks, SUCCESS_CLOSE_MS);
        return () => clearTimeout(handle);
    }, [status]);

    const preview = hovered ?? rating ?? 0;
    const sending = status === 'sending';

    const select = (value: number): void => {
        setRating(value);
        starRefs.current[value - VOC_RATING_MIN]?.focus();
    };

    const handleStarKeyDown = (event: KeyboardEvent, value: number): void => {
        const next: Partial<Record<string, number>> = {
            ArrowRight: Math.min(value + 1, VOC_RATING_MAX),
            ArrowUp: Math.min(value + 1, VOC_RATING_MAX),
            ArrowLeft: Math.max(value - 1, VOC_RATING_MIN),
            ArrowDown: Math.max(value - 1, VOC_RATING_MIN),
            Home: VOC_RATING_MIN,
            End: VOC_RATING_MAX,
        };
        const target = next[event.key];
        if (target === undefined) return;
        event.preventDefault();
        select(target);
    };

    if (status === 'sent') {
        return (
            <ModalShell
                titleId={titleId}
                onClose={onClose}
                focusPanel
                className="max-w-sm bg-secondary-900 p-6 shadow-2xl ring-1 ring-secondary-700"
            >
                <div
                    role="status"
                    className="flex flex-col items-center gap-3 py-4 text-center"
                >
                    <CheckIcon className="size-8 text-ui-success-text" />
                    <h2
                        id={titleId}
                        className="font-semibold text-secondary-50"
                    >
                        {t('VocPromptModal.thanks')}
                    </h2>
                </div>
            </ModalShell>
        );
    }

    return (
        <ModalShell
            titleId={titleId}
            descriptionId={descriptionId}
            onClose={onClose}
            focusPanel
            busy={sending}
            className="max-w-sm bg-secondary-900 p-6 shadow-2xl ring-1 ring-secondary-700"
        >
            <div className="mb-4 flex flex-col items-center gap-2 text-center">
                <h2 id={titleId} className="font-semibold text-secondary-50">
                    {t('VocPromptModal.title')}
                </h2>
                <p
                    id={descriptionId}
                    className="text-sm leading-relaxed text-secondary-300"
                >
                    {t('VocPromptModal.body')}
                </p>
            </div>

            <div
                role="radiogroup"
                aria-label={t('VocPromptModal.ratingLabel')}
                className="mb-4 flex justify-center"
            >
                {STARS.map(value => (
                    <button
                        key={value}
                        ref={node => {
                            starRefs.current[value - VOC_RATING_MIN] = node;
                        }}
                        type="button"
                        role="radio"
                        aria-checked={rating === value}
                        aria-label={t('VocPromptModal.starLabel', {
                            rating: value,
                        })}
                        // 아무것도 안 골랐으면 첫 별, 골랐으면 고른 별만 탭 순서에 둔다(roving tabindex).
                        tabIndex={(rating ?? VOC_RATING_MIN) === value ? 0 : -1}
                        onClick={() => select(value)}
                        onKeyDown={event => handleStarKeyDown(event, value)}
                        onMouseEnter={() => setHovered(value)}
                        onMouseLeave={() => setHovered(null)}
                        onFocus={() => setHovered(null)}
                        className={cn(
                            'inline-flex size-11 touch-manipulation items-center justify-center rounded-lg focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none',
                            value <= preview
                                ? 'text-ui-warning-text'
                                : 'text-secondary-500'
                        )}
                    >
                        <StarIcon
                            filled={value <= preview}
                            className="size-7"
                        />
                    </button>
                ))}
            </div>

            <label
                htmlFor={commentId}
                className="mb-1 block text-xs text-secondary-400"
            >
                {t('VocPromptModal.commentLabel')}
            </label>
            <textarea
                id={commentId}
                value={comment}
                maxLength={VOC_COMMENT_MAX_LENGTH}
                rows={3}
                placeholder={t('VocPromptModal.placeholder')}
                onChange={event => setComment(event.target.value)}
                className="w-full resize-none rounded-lg border border-border-control bg-secondary-800 px-3 py-2 text-base text-secondary-100 placeholder:text-secondary-500 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none sm:text-sm"
            />
            <p className="mt-1 mb-4 text-right text-xs text-secondary-400">
                {t('VocPromptModal.counter', {
                    current: comment.length,
                    max: VOC_COMMENT_MAX_LENGTH,
                })}
            </p>

            {/* 오류 자리는 늘 마운트해 둔다 - 내용과 함께 삽입된 alert는 읽히지 않는다. */}
            <p
                role="alert"
                className="mb-3 min-h-5 text-sm text-ui-danger-text"
            >
                {status === 'error' ? t('VocPromptModal.failed') : ''}
            </p>

            <div className="flex flex-col gap-2">
                <button
                    type="button"
                    disabled={rating === null || sending}
                    onClick={() => {
                        if (rating !== null) void submit(rating, comment);
                    }}
                    className={cn(BUTTON_PRIMARY, ACTION_SIZE)}
                >
                    {t('VocPromptModal.submit')}
                </button>
                <button
                    type="button"
                    onClick={onClose}
                    className={cn(BUTTON_GHOST, ACTION_SIZE)}
                >
                    {t('VocPromptModal.close')}
                </button>
            </div>
        </ModalShell>
    );
}
