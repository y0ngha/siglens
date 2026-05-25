import { countSkillsByType } from '@/shared/lib/skillUtils';
import type { SkillShowcaseItem, SkillType } from '@y0ngha/siglens-core';

function makeSkill(type: SkillType | null): SkillShowcaseItem {
    return {
        type: type ?? undefined,
        name: 'test',
        description: 'test',
        confidenceWeight: 1,
    } as SkillShowcaseItem;
}

describe('countSkillsByType', () => {
    it('returns empty object for empty array', () => {
        expect(countSkillsByType([])).toEqual({});
    });

    it('counts skills of a single type', () => {
        const skills = [
            makeSkill('pattern'),
            makeSkill('pattern'),
            makeSkill('pattern'),
        ];
        expect(countSkillsByType(skills)).toEqual({ pattern: 3 });
    });

    it('counts skills across multiple types', () => {
        const skills = [
            makeSkill('pattern'),
            makeSkill('indicator_guide'),
            makeSkill('pattern'),
            makeSkill('strategy'),
        ];
        const result = countSkillsByType(skills);
        expect(result).toEqual({ pattern: 2, indicator_guide: 1, strategy: 1 });
    });

    it('skips skills with nullish type (null coerced to undefined by makeSkill)', () => {
        const skills = [
            makeSkill('pattern'),
            makeSkill(null),
            makeSkill('pattern'),
        ];
        expect(countSkillsByType(skills)).toEqual({ pattern: 2 });
    });

    it('skips skills with undefined type', () => {
        const skills = [
            {
                name: 'test',
                description: 'test',
                confidenceWeight: 1,
            } as unknown as SkillShowcaseItem,
            makeSkill('candlestick'),
        ];
        expect(countSkillsByType(skills)).toEqual({ candlestick: 1 });
    });

    it('returns Partial Record (not all SkillType keys are required)', () => {
        const skills = [makeSkill('support_resistance')];
        const result = countSkillsByType(skills);
        expect(result.support_resistance).toBe(1);
        expect(result.pattern).toBeUndefined();
    });
});
