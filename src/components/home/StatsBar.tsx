import type { SkillShowcaseItem } from '@/domain/types';

interface StatsBarProps {
    skills: SkillShowcaseItem[];
}

export function StatsBar({ skills }: StatsBarProps) {
    const { indicatorCount, patternCount, strategyCount } = skills.reduce(
        (counts, skill) => {
            if (skill.type === 'indicator_guide') {
                counts.indicatorCount++;
            } else if (skill.type === 'pattern') {
                counts.patternCount++;
            } else if (skill.type === 'strategy') {
                counts.strategyCount++;
            }
            return counts;
        },
        { indicatorCount: 0, patternCount: 0, strategyCount: 0 }
    );

    return (
        <div className="text-secondary-500 mt-6 flex flex-wrap items-center justify-center gap-x-2 font-mono text-xs lg:justify-start">
            <span>{skills.length}개 분석 스킬</span>
            <span className="text-secondary-700">·</span>
            <span>{indicatorCount}종 보조지표</span>
            <span className="text-secondary-700">·</span>
            <span>{patternCount}개 차트 패턴</span>
            <span className="text-secondary-700">·</span>
            <span>{strategyCount}개 전략 분석</span>
        </div>
    );
}
