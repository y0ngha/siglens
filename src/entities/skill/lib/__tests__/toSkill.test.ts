import { describe, expect, it } from 'vitest';
import { toSkill } from '../toSkill';

describe('toSkill', () => {
    describe('indicators 필드', () => {
        it('indicators에서 문자열이 아닌 원소는 버린다', () => {
            expect(
                toSkill({ indicators: ['rsi', 3, null] }, '').indicators
            ).toEqual(['rsi']);
        });

        it('indicators가 배열이 아니면 빈 배열', () => {
            expect(toSkill({ indicators: 'rsi' }, '').indicators).toEqual([]);
        });
    });

    describe('열거형·불리언 필드', () => {
        it('알 수 없는 type·category는 undefined', () => {
            const skill = toSkill({ type: 'nope', category: 'nope' }, '');
            expect(skill.type).toBeUndefined();
            expect(skill.category).toBeUndefined();
        });

        it("smc_full_guide 'true' 문자열도 true로 읽는다", () => {
            expect(toSkill({ smc_full_guide: 'true' }, '').smcFullGuide).toBe(
                true
            );
        });
    });

    describe('usage_roles 필드', () => {
        it('usage_roles를 정규 순서로 정렬해 usageRoles에 매핑한다', () => {
            expect(
                toSkill({ usage_roles: ['confirmation', 'signal'] }, '')
                    .usageRoles
            ).toEqual(['signal', 'confirmation']);
        });
    });
});
