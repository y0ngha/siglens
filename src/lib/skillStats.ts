import type { SkillShowcaseItem, SkillType } from '@y0ngha/siglens-core';
import { countSkillsByType } from '@/domain/skills';

export interface SkillStat {
    value: number;
    label: string;
}

export interface SkillStatConfig {
    countLabel: string;
}

export const SKILL_STAT_CONFIG: Record<SkillType, SkillStatConfig> = {
    indicator_guide: { countLabel: '종 보조지표' },
    pattern: { countLabel: '개 차트 패턴' },
    strategy: { countLabel: '개 전략 분석' },
    candlestick: { countLabel: '개 캔들 패턴' },
    support_resistance: { countLabel: '개 지지/저항 도구' },
};

// SKILL_STAT_CONFIG keys are exactly the SkillType union — cast is safe
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
