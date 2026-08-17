import type { SkillShowcaseItem, SkillType } from '@y0ngha/siglens-core';

export function countSkillsByType(
    skills: readonly SkillShowcaseItem[]
): Partial<Record<SkillType, number>> {
    // 스킬마다 객체를 복제하지 않고 로컬 누적기를 증가시킨다(O(n)).
    const counts: Partial<Record<SkillType, number>> = {};
    for (const skill of skills) {
        if (skill.type == null) continue;
        counts[skill.type] = (counts[skill.type] ?? 0) + 1;
    }
    return counts;
}
