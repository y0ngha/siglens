import type { SkillShowcaseItem, SkillType } from '@y0ngha/siglens-core';
import { SKILL_TYPE_META, type SkillTypeMeta } from './skillTypeMeta';

/** 스킬 쇼케이스 탭 값 — 전체 또는 core `SkillType` 하나. */
export type SkillsActiveTab = 'all' | SkillType;

export interface SkillTab {
    readonly value: SkillsActiveTab;
    /** 메시지 키 — `TabsPill`에는 번역된 `label`로 바꿔서 넘긴다. */
    readonly labelKey: string;
}

const ALL_TAB: SkillTab = { value: 'all', labelKey: 'skillFilter.all' };

/**
 * 탭 목록 — "전체" + `SKILL_TYPE_META`의 모든 타입.
 *
 * 손으로 적지 않고 타입 레코드에서 파생해, core `SkillType`이 늘어나도 탭이 빠질 수 없다.
 */
export const SKILL_TABS: readonly SkillTab[] = [
    ALL_TAB,
    ...(Object.entries(SKILL_TYPE_META) as [SkillType, SkillTypeMeta][]).map(
        ([value, meta]) => ({ value, labelKey: meta.tabLabelKey })
    ),
];

/** 패널마다 "더 보기" 전에 보여주는 카드 수. */
export const INITIAL_VISIBLE_COUNT = 12;

/** 탭에 속한 스킬만 고른다. "전체"는 입력을 그대로 돌려준다(순서 유지). */
export function filterSkillsByTab(
    skills: readonly SkillShowcaseItem[],
    tab: SkillsActiveTab
): readonly SkillShowcaseItem[] {
    return tab === 'all' ? skills : skills.filter(skill => skill.type === tab);
}
