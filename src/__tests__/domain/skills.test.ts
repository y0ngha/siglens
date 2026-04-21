import { buildSkillStats, countSkillsByType } from '@/domain/skills';
import type { SkillShowcaseItem, SkillType } from '@/domain/types';

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
            expect(result.find(s => s.label === '종 보조지표')?.value).toBe(2);
            expect(result.find(s => s.label === '개 차트 패턴')?.value).toBe(1);
            expect(result.find(s => s.label === '개 전략 분석')?.value).toBe(1);
            expect(result.find(s => s.label === '개 캔들 패턴')?.value).toBe(1);
            expect(result.find(s => s.label === '개 지지/저항 도구')?.value).toBe(1);
        });
    });

    describe('일부 타입이 없는 경우', () => {
        it('누락된 타입은 0을 반환한다', () => {
            const skills: SkillShowcaseItem[] = [
                buildSkill({ type: 'indicator_guide' }),
            ];
            const result = buildSkillStats(skills);
            expect(result.find(s => s.label === '개 차트 패턴')?.value).toBe(0);
            expect(result.find(s => s.label === '개 전략 분석')?.value).toBe(0);
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
