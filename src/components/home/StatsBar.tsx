import type { SkillShowcaseItem } from '@/domain/types';

interface StatsBarProps {
    skills: SkillShowcaseItem[];
}

export function StatsBar({ skills }: StatsBarProps) {
    const { indicatorCount, patternCount, strategyCount, candlestickCount } =
        skills.reduce(
            (counts, skill) => {
                if (skill.type === 'indicator_guide') {
                    return {
                        ...counts,
                        indicatorCount: counts.indicatorCount + 1,
                    };
                }
                if (skill.type === 'pattern') {
                    return {
                        ...counts,
                        patternCount: counts.patternCount + 1,
                    };
                }
                if (skill.type === 'strategy') {
                    return {
                        ...counts,
                        strategyCount: counts.strategyCount + 1,
                    };
                }
                if (skill.type === 'candlestick') {
                    return {
                        ...counts,
                        candlestickCount: counts.candlestickCount + 1,
                    };
                }
                return counts;
            },
            {
                indicatorCount: 0,
                patternCount: 0,
                strategyCount: 0,
                candlestickCount: 0,
            }
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
            <span className="text-secondary-700">·</span>
            <span>{candlestickCount}개 캔들 패턴</span>
        </div>
    );
}
