import type { SkillShowcaseItem, SkillType } from '@y0ngha/siglens-core';

import { SKILL_TABS, filterSkillsByTab } from '../../utils/skillTabs';
import { SKILL_TYPE_META } from '../../utils/skillTypeMeta';

/**
 * core `SkillType` 전체. `Record<SkillType, true>`라 core에 타입이 늘면 이 객체가
 * 컴파일 에러가 나서, 아래 탭 커버리지 검사가 새 타입을 놓치지 못한다.
 */
const ALL_SKILL_TYPES = Object.keys({
    pattern: true,
    indicator_guide: true,
    strategy: true,
    candlestick: true,
    support_resistance: true,
} satisfies Record<SkillType, true>) as SkillType[];

function skill(
    name: string,
    type: SkillShowcaseItem['type']
): SkillShowcaseItem {
    return { name, type, description: '', confidenceWeight: 0.5 };
}

describe('SKILL_TABS', () => {
    it('첫 탭은 "all"이고 이후는 core SkillType 전부를 하나씩 포함한다', () => {
        expect(SKILL_TABS[0]).toEqual({
            value: 'all',
            labelKey: 'skillFilter.all',
        });
        expect(
            SKILL_TABS.slice(1)
                .map(tab => tab.value)
                .sort()
        ).toEqual([...ALL_SKILL_TYPES].sort());
    });

    it('탭 값이 중복되지 않는다', () => {
        const values = SKILL_TABS.map(tab => tab.value);
        expect(new Set(values).size).toBe(values.length);
    });

    it('타입 탭의 라벨 키는 SKILL_TYPE_META에서 온다', () => {
        SKILL_TABS.slice(1).forEach(tab => {
            expect(tab.labelKey).toBe(
                SKILL_TYPE_META[tab.value as SkillType].tabLabelKey
            );
        });
    });
});

describe('filterSkillsByTab', () => {
    const SKILLS = [
        skill('a', 'pattern'),
        skill('b', 'strategy'),
        skill('c', undefined),
        skill('d', 'pattern'),
    ];

    it('"all"은 타입 없는 스킬 포함 전부를 순서대로 돌려준다', () => {
        expect(filterSkillsByTab(SKILLS, 'all')).toEqual(SKILLS);
    });

    it('타입 탭은 그 타입만 고른다', () => {
        expect(filterSkillsByTab(SKILLS, 'pattern').map(s => s.name)).toEqual([
            'a',
            'd',
        ]);
    });

    it('해당 스킬이 없으면 빈 배열이다', () => {
        expect(filterSkillsByTab(SKILLS, 'candlestick')).toEqual([]);
    });
});
