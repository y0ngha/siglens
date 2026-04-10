import { Fragment } from 'react';

import type { SkillShowcaseItem, SkillType } from '@/domain/types';

type CountKey =
    | 'indicatorCount'
    | 'patternCount'
    | 'strategyCount'
    | 'candlestickCount'
    | 'supportResistanceCount';

const SKILL_TYPE_TO_COUNT_KEY: Record<SkillType, CountKey> = {
    indicator_guide: 'indicatorCount',
    pattern: 'patternCount',
    strategy: 'strategyCount',
    candlestick: 'candlestickCount',
    support_resistance: 'supportResistanceCount',
};

const INITIAL_COUNTS: Record<CountKey, number> = {
    indicatorCount: 0,
    patternCount: 0,
    strategyCount: 0,
    candlestickCount: 0,
    supportResistanceCount: 0,
};

interface StatsBarProps {
    skills: SkillShowcaseItem[];
}

export function StatsBar({ skills }: StatsBarProps) {
    const counts = skills.reduce(
        (acc, skill) => {
            const key =
                skill.type != null
                    ? SKILL_TYPE_TO_COUNT_KEY[skill.type]
                    : undefined;
            if (key == null) return acc;
            return { ...acc, [key]: acc[key] + 1 };
        },
        { ...INITIAL_COUNTS }
    );

    const stats = [
        { value: skills.length, label: '개 분석 스킬' },
        { value: counts.indicatorCount, label: '종 보조지표' },
        { value: counts.patternCount, label: '개 차트 패턴' },
        { value: counts.strategyCount, label: '개 전략 분석' },
        { value: counts.candlestickCount, label: '개 캔들 패턴' },
        { value: counts.supportResistanceCount, label: '개 지지/저항 도구' },
    ];

    return (
        <div className="text-secondary-500 mt-6 flex flex-wrap items-center justify-center gap-x-2 font-mono text-xs lg:justify-start">
            {stats.map((stat, i) => (
                <Fragment key={stat.label}>
                    {i > 0 && <span className="text-secondary-700">·</span>}
                    <span>
                        {stat.value}
                        {stat.label}
                    </span>
                </Fragment>
            ))}
        </div>
    );
}
