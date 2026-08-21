import type { SkillShowcaseItem, SkillType } from '@y0ngha/siglens-core';
import { countSkillsByType } from './skillUtils';

/** `shared.lib.skillStats.count`의 서브키 — 'total' 또는 SkillType. */
export type SkillStatKey = SkillType | 'total';

export interface SkillStat {
    key: SkillStatKey;
    value: number;
}

// SKILL_TYPE_ORDER 키는 SkillType과 exhaustiveness가 맞아야 한다 — 새
// SkillType이 core에 추가되면 여기서 컴파일 에러로 잡힌다.
const SKILL_TYPE_ORDER = {
    indicator_guide: true,
    pattern: true,
    strategy: true,
    candlestick: true,
    support_resistance: true,
} satisfies Record<SkillType, true>;

const SKILL_TYPES = Object.keys(SKILL_TYPE_ORDER) as SkillType[];

export function buildSkillStats(
    skills: readonly SkillShowcaseItem[]
): SkillStat[] {
    const typeCounts = countSkillsByType(skills);
    return [
        { key: 'total', value: skills.length },
        ...SKILL_TYPES.map(type => ({
            key: type,
            value: typeCounts[type] ?? 0,
        })),
    ];
}
