import type { CSSProperties } from 'react';
import { Fragment } from 'react';

import type { SkillShowcaseItem } from '@y0ngha/siglens-core';
import { DotSeparator } from '@/shared/ui/DotSeparator';
import { buildSkillStats } from '@/shared/lib/skillStats';

interface StatsBarProps {
    skills: SkillShowcaseItem[];
}

// 시맨틱 list 래퍼로 분석 통계 그룹을 한 묶음으로 표현 — 스크린 리더가
// "list, 6 items"로 안내해 단순 텍스트 나열보다 구조 인식이 명확해진다.
// 시각 표현(가운뎃점 구분자, 가로 정렬)은 그대로 유지하기 위해 list-none 적용.
export function StatsBar({ skills }: StatsBarProps) {
    const stats = buildSkillStats(skills);

    return (
        <ul
            aria-label="Siglens 분석 규모"
            className="text-secondary-400 mt-6 flex list-none flex-wrap items-center justify-center gap-x-2 p-0 font-mono text-xs md:justify-start"
        >
            {stats.map((stat, i) => (
                <Fragment key={stat.label}>
                    {i > 0 && (
                        // 구분자는 시각 장식 — DotSeparator 내부에서 aria-hidden 처리되어 있어도
                        // 의미 단위가 아니므로 list item 바깥에 둔다.
                        <li aria-hidden="true" className="contents">
                            <DotSeparator />
                        </li>
                    )}
                    <li>
                        {stat.value}
                        {stat.label}
                    </li>
                </Fragment>
            ))}
        </ul>
    );
}

export function StatsBarSkeleton() {
    return (
        <div
            aria-hidden="true"
            className="mt-6 flex flex-wrap items-center justify-center gap-x-2 md:justify-start"
        >
            {[80, 60, 72, 56, 68, 64].map((w, i) => (
                <Fragment key={i}>
                    {i > 0 && <DotSeparator />}
                    <div
                        className="bg-secondary-700/50 h-3 w-[var(--stat-w)] animate-pulse rounded"
                        style={{ '--stat-w': `${w}px` } as CSSProperties}
                    />
                </Fragment>
            ))}
        </div>
    );
}
