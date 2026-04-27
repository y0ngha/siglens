import { buildSkillStats, SKILL_STAT_CONFIG } from '@/lib/skillStats';
import type { SkillShowcaseItem } from '@y0ngha/siglens-core';

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

describe('buildSkillStats', () => {
    describe('빈 배열', () => {
        it('모든 항목의 value가 0인 배열을 반환한다', () => {
            const result = buildSkillStats([]);
            expect(result[0].value).toBe(0);
            result.slice(1).forEach(s => expect(s.value).toBe(0));
        });
    });

    describe('모든 타입이 포함된 경우', () => {
        it('타입별 개수를 정확히 반환한다', () => {
            const skills: SkillShowcaseItem[] = [
                buildSkill({ type: 'indicator_guide' }),
                buildSkill({ type: 'indicator_guide' }),
                buildSkill({ type: 'pattern' }),
                buildSkill({ type: 'strategy' }),
                buildSkill({ type: 'candlestick' }),
                buildSkill({ type: 'support_resistance' }),
            ];
            const result = buildSkillStats(skills);
            expect(result[0].value).toBe(6);
            expect(
                result.find(
                    s =>
                        s.label === SKILL_STAT_CONFIG.indicator_guide.countLabel
                )?.value
            ).toBe(2);
            expect(
                result.find(
                    s => s.label === SKILL_STAT_CONFIG.pattern.countLabel
                )?.value
            ).toBe(1);
            expect(
                result.find(
                    s => s.label === SKILL_STAT_CONFIG.strategy.countLabel
                )?.value
            ).toBe(1);
            expect(
                result.find(
                    s => s.label === SKILL_STAT_CONFIG.candlestick.countLabel
                )?.value
            ).toBe(1);
            expect(
                result.find(
                    s =>
                        s.label ===
                        SKILL_STAT_CONFIG.support_resistance.countLabel
                )?.value
            ).toBe(1);
        });
    });

    describe('일부 타입이 없는 경우', () => {
        it('누락된 타입은 0을 반환한다', () => {
            const skills: SkillShowcaseItem[] = [
                buildSkill({ type: 'indicator_guide' }),
            ];
            const result = buildSkillStats(skills);
            expect(
                result.find(
                    s => s.label === SKILL_STAT_CONFIG.pattern.countLabel
                )?.value
            ).toBe(0);
            expect(
                result.find(
                    s => s.label === SKILL_STAT_CONFIG.strategy.countLabel
                )?.value
            ).toBe(0);
        });
    });

    describe('반환 구조', () => {
        it('value와 label 필드를 가진 SkillStat[] 를 반환한다', () => {
            const result = buildSkillStats([buildSkill()]);
            result.forEach(s => {
                expect(typeof s.value).toBe('number');
                expect(typeof s.label).toBe('string');
            });
        });
    });
});
