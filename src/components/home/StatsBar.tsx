import type { SkillShowcaseItem } from '@/domain/types';

interface StatsBarProps {
    skills: SkillShowcaseItem[];
}

export function StatsBar({ skills }: StatsBarProps) {
    const indicatorCount = skills.filter(
        s => s.type === 'indicator_guide'
    ).length;
    const patternCount = skills.filter(s => s.type === 'pattern').length;
    const strategyCount = skills.filter(s => s.type === 'strategy').length;

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
