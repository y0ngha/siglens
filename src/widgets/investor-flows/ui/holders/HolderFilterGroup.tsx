/**
 * 보유 기관 목록의 "전체 / 신규 진입 / 완전 청산" 필터 버튼 묶음.
 */
import { useId } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/shared/lib/cn';
import { HOLDER_FILTERS } from '../../utils/holderStatus';
import type { HolderFilter } from '../../utils/institutional';

interface HolderFilterGroupProps {
    readonly value: HolderFilter;
    readonly counts: Record<HolderFilter, number>;
    readonly onChange: (filter: HolderFilter) => void;
}

/** 눌린 버튼은 `aria-pressed`와 색으로 함께 드러난다. 그룹 이름은 화면 밖 라벨로 붙인다. */
export function HolderFilterGroup({
    value,
    counts,
    onChange,
}: HolderFilterGroupProps) {
    const t = useTranslations('widgets.investor-flows');
    const tFilter = useTranslations('widgets.investor-flows.filter');
    const groupId = useId();
    // 라벨은 리터럴 번역 호출로 만들어 두고 필터로 고른다(추출기가 키를 볼 수 있게).
    const labels: Record<HolderFilter, string> = {
        all: tFilter('all', { count: counts.all }),
        new: tFilter('new', { count: counts.new }),
        exited: tFilter('exited', { count: counts.exited }),
    };
    return (
        <div
            role="group"
            aria-labelledby={`${groupId}-label`}
            className="flex gap-1"
        >
            <span id={`${groupId}-label`} className="sr-only">
                {t('holders.filterLabel')}
            </span>
            {HOLDER_FILTERS.map(filter => (
                <button
                    key={filter}
                    type="button"
                    aria-pressed={value === filter}
                    onClick={() => onChange(filter)}
                    className={cn(
                        'tap-target rounded border px-2.5 py-1 text-xs font-medium focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none',
                        value === filter
                            ? 'border-primary-500 bg-primary-500/10 text-primary-400'
                            : 'border-border-control text-secondary-300 hover:border-primary-500'
                    )}
                >
                    {labels[filter]}
                </button>
            ))}
        </div>
    );
}
