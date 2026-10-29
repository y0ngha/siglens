/** 가이드 목록의 분류 칩 줄(토글 버튼 묶음). */
import { useTranslations } from 'next-intl';
import { cn } from '@/shared/lib/cn';
import type {
    GuideFilterCategory,
    GuideFilterChip,
} from '@/views/guide/lib/guideBrowse';

const CHIP_BASE =
    'inline-flex min-h-11 touch-manipulation items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none motion-reduce:transition-none';
const CHIP_IDLE =
    'border-border-control text-secondary-300 hover:bg-secondary-800 hover:text-secondary-100';
const CHIP_ACTIVE = 'border-primary-400 bg-secondary-800 text-primary-400';

interface GuideFilterChipsProps {
    readonly chips: readonly GuideFilterChip[];
    readonly selected: GuideFilterCategory;
    readonly onSelect: (category: GuideFilterCategory) => void;
}

/**
 * 고른 칩은 `aria-pressed`로만 표시하고 이름은 그대로 둔다. 이름과 개수 사이에는 실제 공백을 둔다 —
 * 간격이 CSS(`gap`)뿐이면 접근 가능한 이름이 "전체90"처럼 붙어 읽힌다(플렉스 항목 사이의 공백 글자는 그려지지 않는다).
 */
export function GuideFilterChips({
    chips,
    selected,
    onSelect,
}: GuideFilterChipsProps) {
    const t = useTranslations('views.guide');
    return (
        <div
            role="group"
            aria-label={t('filterLabel')}
            className="flex flex-wrap gap-2"
        >
            {chips.map(chip => {
                const active = selected === chip.value;
                return (
                    <button
                        key={chip.value}
                        type="button"
                        aria-pressed={active}
                        onClick={() => onSelect(chip.value)}
                        className={cn(
                            CHIP_BASE,
                            active ? CHIP_ACTIVE : CHIP_IDLE
                        )}
                    >
                        {chip.label}{' '}
                        <span
                            className={cn(
                                'text-xs tabular-nums',
                                active
                                    ? 'text-primary-400'
                                    : 'text-secondary-400'
                            )}
                        >
                            {chip.count}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
