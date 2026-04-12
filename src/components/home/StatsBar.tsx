import { Fragment } from 'react';

import type { SkillShowcaseItem, SkillType } from '@/domain/types';
import { FileSkillsLoader } from '@/infrastructure/skills/loader';

interface SkillStatConfig {
    countLabel: string;
}

const SKILL_STAT_CONFIG: Record<SkillType, SkillStatConfig> = {
    indicator_guide: { countLabel: '종 보조지표' },
    pattern: { countLabel: '개 차트 패턴' },
    strategy: { countLabel: '개 전략 분석' },
    candlestick: { countLabel: '개 캔들 패턴' },
    support_resistance: { countLabel: '개 지지/저항 도구' },
};

const SKILL_TYPES = Object.keys(SKILL_STAT_CONFIG) as SkillType[];

interface StatsBarProps {
    skills: SkillShowcaseItem[];
}

export function StatsBar({ skills }: StatsBarProps) {
    const typeCounts = skills.reduce<Partial<Record<SkillType, number>>>(
        (acc, skill) => {
            if (skill.type == null) return acc;
            return { ...acc, [skill.type]: (acc[skill.type] ?? 0) + 1 };
        },
        {}
    );

    const stats = [
        { value: skills.length, label: '개 분석 스킬' },
        ...SKILL_TYPES.map(type => ({
            value: typeCounts[type] ?? 0,
            label: SKILL_STAT_CONFIG[type].countLabel,
        })),
    ];

    return (
        <div className="text-secondary-400 mt-6 flex flex-wrap items-center justify-center gap-x-2 font-mono text-xs lg:justify-start">
            {stats.map((stat, i) => (
                <Fragment key={stat.label}>
                    {i > 0 && (
                        <span className="text-secondary-700" aria-hidden="true">
                            ·
                        </span>
                    )}
                    <span>
                        {stat.value}
                        {stat.label}
                    </span>
                </Fragment>
            ))}
        </div>
    );
}

export function StatsBarSkeleton() {
    return (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-2 lg:justify-start">
            {[80, 60, 72, 56, 68, 64].map((w, i) => (
                <Fragment key={i}>
                    {i > 0 && (
                        <span className="text-secondary-700" aria-hidden="true">
                            ·
                        </span>
                    )}
                    <div
                        className="bg-secondary-700/50 h-3 animate-pulse rounded"
                        style={{ width: `${w}px` }}
                    />
                </Fragment>
            ))}
        </div>
    );
}

export async function AsyncStatsBar() {
    const loader = new FileSkillsLoader();
    const skills = await loader.loadSkills();
    return <StatsBar skills={skills} />;
}
