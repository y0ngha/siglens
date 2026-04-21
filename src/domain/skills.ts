import type { SkillShowcaseItem, SkillStat, SkillType } from '@/domain/types';

export function countSkillsByType(
    skills: readonly SkillShowcaseItem[]
): Partial<Record<SkillType, number>> {
    return skills.reduce<Partial<Record<SkillType, number>>>((acc, skill) => {
        if (skill.type == null) return acc;
        return { ...acc, [skill.type]: (acc[skill.type] ?? 0) + 1 };
    }, {});
}

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

export function buildSkillStats(
    skills: readonly SkillShowcaseItem[]
): SkillStat[] {
    const typeCounts = countSkillsByType(skills);
    return [
        { value: skills.length, label: '개 분석 스킬' },
        ...SKILL_TYPES.map(type => ({
            value: typeCounts[type] ?? 0,
            label: SKILL_STAT_CONFIG[type].countLabel,
        })),
    ];
}
