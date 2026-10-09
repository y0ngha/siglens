'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/shared/lib/cn';
import { BUTTON_GHOST } from '@/shared/lib/buttonStyles';
import { CloseIcon } from '@/shared/ui/StrokeIcons';

interface WatchlistCoachMarkProps {
    /** 트리거 버튼의 `aria-describedby`가 가리키는 id(AX-2). */
    id: string;
    onDismiss: () => void;
}

/*
 * 앵커(☆ 버튼, 375px에서 우변 x≈255)의 오른쪽에 맞춰 아래로 편다. 폭 `w-60`(240px)이라
 * 가장 좁은 뷰포트에서도 왼쪽이 0을 넘지 않는다(DS-7: 320px 박스는 넘친다 — 256px 이상 금지).
 * 포커스를 가져가지 않는다 — 안내지 조작이 아니다(§6.1).
 */
const BUBBLE = cn(
    'absolute top-full right-0 z-50 mt-2 w-60 rounded-lg border border-secondary-700 bg-secondary-900 p-3 text-xs leading-relaxed text-secondary-200 shadow-lg',
    'motion-safe:animate-[fade-in_150ms_ease-out]'
);

export function WatchlistCoachMark({ id, onDismiss }: WatchlistCoachMarkProps) {
    const t = useTranslations('features.watchlist');
    return (
        <div id={id} role="tooltip" className={BUBBLE}>
            <div className="flex items-start gap-2">
                <p className="min-w-0 flex-1">{t('coach.body')}</p>
                <button
                    type="button"
                    onClick={onDismiss}
                    aria-label={t('coach.dismiss')}
                    className={cn(BUTTON_GHOST, 'size-6 shrink-0 rounded')}
                >
                    <CloseIcon className="size-3.5" />
                </button>
            </div>
        </div>
    );
}
