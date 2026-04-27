import { countSkillsByType } from '@/domain/skills';
import type { SkillShowcaseItem, SkillType } from '@y0ngha/siglens-core';

function buildSkill(
    overrides: Partial<SkillShowcaseItem> = {}
): SkillShowcaseItem {
    return {
        name: 'test-skill',
        description: '',
        type: 'indicator_guide',
        confidenceWeight: 0.9,
        ...overrides,
    };
}

function buildUntypedSkill(): SkillShowcaseItem {
    return { name: 'test-skill', description: '', confidenceWeight: 0.9 };
}

describe('countSkillsByType', () => {
    describe('빈 배열', () => {
        it('빈 객체를 반환한다', () => {
            expect(countSkillsByType([])).toEqual({});
        });
    });

    describe('타입이 undefined인 항목', () => {
        it('집계에서 제외된다', () => {
            const skills = [
                buildUntypedSkill(),
                buildSkill({ type: 'pattern' }),
            ];
            expect(countSkillsByType(skills)).toEqual({ pattern: 1 });
        });
    });

    describe('단일 타입 여러 항목', () => {
        it('해당 타입의 개수를 정확히 센다', () => {
            const skills: SkillShowcaseItem[] = [
                buildSkill({ type: 'indicator_guide' }),
                buildSkill({ type: 'indicator_guide' }),
                buildSkill({ type: 'indicator_guide' }),
            ];
            expect(countSkillsByType(skills)).toEqual({ indicator_guide: 3 });
        });
    });

    describe('여러 타입 혼합', () => {
        it('각 타입별 개수를 독립적으로 집계한다', () => {
            const types: SkillType[] = [
                'indicator_guide',
                'indicator_guide',
                'pattern',
                'strategy',
                'candlestick',
                'candlestick',
                'support_resistance',
            ];
            const skills = types.map(t => buildSkill({ type: t }));
            expect(countSkillsByType(skills)).toEqual({
                indicator_guide: 2,
                pattern: 1,
                strategy: 1,
                candlestick: 2,
                support_resistance: 1,
            });
        });
    });
});
