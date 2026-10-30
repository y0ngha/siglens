import type { Skill, SkillCategory, SkillCounts } from '@y0ngha/siglens-core';
import { countSkillsByType } from '@/shared/lib/skillUtils';

/**
 * 스킬 목록을 카탈로그 규모(`SkillCounts`)로 집계한다. `type` / `category` frontmatter 기준이며
 * 디렉터리 기준이 아니다. 홈·about·methodology·종목 페이지가 `countSkillFiles`를 통해 같은 수를
 * 말하도록 집계 규칙을 한 곳에 둔다.
 */
export const countSkills = (skills: readonly Skill[]): SkillCounts => {
    const byType = countSkillsByType(skills);
    // 스킬마다 객체를 복제하지 않고 로컬 누적기를 증가시킨다(O(n)).
    const byCategory: Partial<Record<SkillCategory, number>> = {};
    for (const skill of skills) {
        if (skill.category == null) continue;
        byCategory[skill.category] = (byCategory[skill.category] ?? 0) + 1;
    }
    return {
        indicators: byType.indicator_guide ?? 0,
        candlesticks: byType.candlestick ?? 0,
        patterns: byType.pattern ?? 0,
        strategies: byType.strategy ?? 0,
        supportResistance: byType.support_resistance ?? 0,
        fundamental: byCategory.fundamental ?? 0,
        news: byCategory.news ?? 0,
    };
};
