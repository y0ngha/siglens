'use client';

import type { CalendarImpact } from '@y0ngha/siglens-core';

import { cn } from '@/shared/lib/cn';

/** 필터 칩 렌더 순서 — High → Medium → Low (그리드 IMPACT_ORDER와 동일) */
const FILTER_IMPACTS: readonly CalendarImpact[] = ['High', 'Medium', 'Low'];

/** 칩 한국어 레이블 — 그리드 IMPACT_LABELS와 동일하게 유지 */
const FILTER_LABEL: Record<CalendarImpact, string> = {
    High: '높음',
    Medium: '보통',
    Low: '낮음',
};

/** 활성 시 칩 색상 — 그리드 IMPACT_BADGE 색 계열과 일치(임팩트 식별성 유지) */
const FILTER_ACTIVE: Record<CalendarImpact, string> = {
    High: 'border-ui-danger/50 bg-ui-danger/15 text-ui-danger-text',
    Medium: 'border-ui-warning/50 bg-ui-warning/15 text-ui-warning-text',
    Low: 'border-secondary-500 bg-secondary-700 text-secondary-200',
};

interface ImpactFilterProps {
    value: ReadonlySet<CalendarImpact>;
    onToggle: (impact: CalendarImpact) => void;
}

/**
 * 경제 캘린더 중요도(영향도) 필터 — 다중 선택 토글 칩 그룹.
 *
 * `PeriodToggle`의 `role="group"` + `aria-pressed` 패턴을 미러링하되,
 * 단일 택일이 아니라 각 칩을 독립 토글하는 다중 선택이다(`value`는 활성 집합).
 *
 * 시각 필터 전용: 이 컴포넌트는 어떤 이벤트도 DOM에서 제거하지 않는다.
 * 상위 그리드가 `value`를 받아 셀/상세를 시각적으로 한정한다.
 */
export function ImpactFilter({ value, onToggle }: ImpactFilterProps) {
    return (
        <div
            role="group"
            aria-label="중요도 필터"
            className="mb-3 flex items-center gap-2"
        >
            {FILTER_IMPACTS.map(impact => {
                const active = value.has(impact);
                return (
                    <button
                        key={impact}
                        type="button"
                        aria-pressed={active}
                        onClick={() => onToggle(impact)}
                        className={cn(
                            'focus-visible:ring-primary-500 inline-flex min-h-11 touch-manipulation items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none motion-reduce:transition-none',
                            active
                                ? FILTER_ACTIVE[impact]
                                : 'border-secondary-700 text-secondary-500 hover:text-secondary-300'
                        )}
                    >
                        <span
                            aria-hidden="true"
                            className={cn(
                                'inline-block h-1.5 w-1.5 rounded-full',
                                active ? 'bg-current' : 'bg-secondary-600'
                            )}
                        />
                        {FILTER_LABEL[impact]}
                    </button>
                );
            })}
        </div>
    );
}
