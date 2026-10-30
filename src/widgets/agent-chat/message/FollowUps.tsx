'use client';

/**
 * 마지막 답 아래의 후속 질문 칩 목록 — 누르면 그 질문을 다음 턴으로 보낸다.
 */
import { useTranslations } from 'next-intl';
import { useId } from 'react';
import { cn } from '@/shared/lib/cn';
import { ArrowUpRightIcon } from '@/shared/ui/StrokeIcons';
import { AI_RAISED_CONTROL } from '../aiSurfaceStyles';

/**
 * Quiet suggestion chip for a follow-up question. Same raised surface as the
 * empty state's `SuggestionCards` card, but shorter (`min-h-11` — the
 * finger-target floor) because it sits under an answer rather than being the
 * screen's focus.
 */
const FOLLOW_UP_CHIP = cn(
    AI_RAISED_CONTROL,
    'group inline-flex min-h-11 max-w-full items-center justify-between gap-3 rounded-lg px-3.5 py-2 text-left text-sm leading-5 text-secondary-200 hover:text-secondary-100'
);

interface FollowUpsProps {
    readonly items: readonly string[];
    readonly onPick: (text: string) => void;
}

/**
 * Follow-up questions the agent offered on its last line, as tappable chips.
 * Rendered only under the last finished answer: a chip under an old answer
 * would send a question about a conversation that has moved on.
 */
export function FollowUps({ items, onPick }: FollowUpsProps) {
    const t = useTranslations('widgets.agent-chat');
    // Per-instance id: every assistant turn could render this component.
    const labelId = useId();
    if (items.length === 0) return null;
    return (
        <div className="mt-4">
            <p id={labelId} className="mb-2 text-xs text-secondary-400">
                {t('MessageList.followUpsLabel')}
            </p>
            <ul aria-labelledby={labelId} className="flex flex-wrap gap-2">
                {items.map((item, i) => (
                    // Index in the key: the model may repeat an item, and a
                    // collision would silently drop a chip.
                    // react-doctor-disable-next-line react-doctor/no-array-index-as-key
                    <li key={`${i}-${item}`} className="max-w-full">
                        <button
                            type="button"
                            onClick={() => onPick(item)}
                            className={FOLLOW_UP_CHIP}
                        >
                            <span className="min-w-0 break-words">{item}</span>
                            <ArrowUpRightIcon className="size-4 shrink-0 text-secondary-400 transition-colors group-hover:text-primary-400 motion-reduce:transition-none" />
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
}
