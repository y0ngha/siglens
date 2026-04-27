import type { SkillShowcaseItem, SkillType } from '@y0ngha/siglens-core';

export function countSkillsByType(
    skills: readonly SkillShowcaseItem[]
): Partial<Record<SkillType, number>> {
    return skills.reduce<Partial<Record<SkillType, number>>>((acc, skill) => {
        if (skill.type == null) return acc;
        return { ...acc, [skill.type]: (acc[skill.type] ?? 0) + 1 };
    }, {});
}
