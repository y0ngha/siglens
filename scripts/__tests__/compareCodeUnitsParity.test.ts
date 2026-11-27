import { describe, expect, it } from 'vitest';
import { compareCodeUnits as srcCompare } from '../../src/shared/lib/compareCodeUnits';
import { compareCodeUnits as scriptCompare } from '../i18n/lib/compareCodeUnits.mjs';

/**
 * `scripts/i18n/lib/compareCodeUnits.mjs`는 `src/shared/lib/compareCodeUnits.ts`의 사본이다.
 * 한쪽만 고쳐져 정렬 순서가 갈라지지 않도록 같은 쌍에서 같은 결과를 내는지 본다.
 */
const SAMPLES = [
    '',
    'a',
    'b',
    'A',
    'Z',
    'ab',
    'a-b',
    'a1',
    'a10',
    'a2',
    '가',
    '나',
    '😀',
];

describe('compareCodeUnits parity (scripts vs src)', () => {
    it('agrees on every ordered pair of samples', () => {
        const pairs = SAMPLES.flatMap(a => SAMPLES.map(b => [a, b] as const));
        expect(pairs.map(([a, b]) => scriptCompare(a, b))).toEqual(
            pairs.map(([a, b]) => srcCompare(a, b))
        );
    });

    it('is not vacuous: the samples produce -1, 0 and 1', () => {
        const results = new Set(
            SAMPLES.flatMap(a => SAMPLES.map(b => srcCompare(a, b)))
        );
        expect([...results].sort()).toEqual([-1, 0, 1]);
    });
});
