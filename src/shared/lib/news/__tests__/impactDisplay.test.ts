import { describe, expect, it } from 'vitest';
import { IMPACT_CLASS, isNewsImpact } from '@/shared/lib/news/impactDisplay';

describe('isNewsImpact', () => {
    it.each(['high', 'medium', 'low', 'negligible'])('%s → true', value => {
        expect(isNewsImpact(value)).toBe(true);
    });

    it('rejects unknown strings, non-strings and Object.prototype keys', () => {
        expect(isNewsImpact('extreme')).toBe(false);
        expect(isNewsImpact(1)).toBe(false);
        expect(isNewsImpact(null)).toBe(false);
        expect(isNewsImpact('toString')).toBe(false);
        expect(isNewsImpact('constructor')).toBe(false);
    });
});

describe('IMPACT_CLASS', () => {
    // 뮤트 배지는 AA 대비를 위해 `-300`을 쓴다(`-400`은 bg-secondary-700 위 미달).
    it.each(['low', 'negligible'] as const)(
        '%s uses the AA-corrected text-secondary-300',
        value => {
            expect(IMPACT_CLASS[value]).toContain('text-secondary-300');
            expect(IMPACT_CLASS[value]).not.toContain('text-secondary-400');
        }
    );
});
