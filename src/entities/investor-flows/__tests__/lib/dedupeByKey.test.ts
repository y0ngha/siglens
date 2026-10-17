import { describe, expect, it } from 'vitest';
import {
    COMPOSITE_KEY_SEPARATOR,
    compositeKey,
    DEDUPE_EXAMPLE_LIMIT,
    dedupeByKey,
} from '../../lib/dedupeByKey';

type Row = { key: string; value: number };
const byKey = (row: Row): string => row.key;

describe('dedupeByKey', () => {
    describe('when keys are unique', () => {
        it('returns the rows unchanged, in order, with nothing dropped', () => {
            const rows = [
                { key: 'b', value: 1 },
                { key: 'a', value: 2 },
            ];
            expect(dedupeByKey(rows, byKey)).toEqual({
                rows,
                dropped: 0,
                exampleKeys: [],
            });
        });

        it('returns an empty result for an empty input', () => {
            expect(dedupeByKey([], byKey)).toEqual({
                rows: [],
                dropped: 0,
                exampleKeys: [],
            });
        });
    });

    describe('when a key repeats', () => {
        it('keeps the LAST row of the key at the position the key first appeared', () => {
            const { rows } = dedupeByKey(
                [
                    { key: 'x', value: 1 },
                    { key: 'y', value: 2 },
                    { key: 'x', value: 3 },
                ],
                byKey
            );
            expect(rows).toEqual([
                { key: 'x', value: 3 },
                { key: 'y', value: 2 },
            ]);
        });

        it('counts every dropped row, including a key repeated three times', () => {
            const { dropped, exampleKeys } = dedupeByKey(
                [
                    { key: 'x', value: 1 },
                    { key: 'x', value: 2 },
                    { key: 'x', value: 3 },
                    { key: 'y', value: 4 },
                ],
                byKey
            );
            expect(dropped).toBe(2);
            expect(exampleKeys).toEqual(['x']);
        });

        it('orders example keys by first appearance, not by when the repeat was seen (A, B, B, A → [A, B])', () => {
            const { rows, exampleKeys } = dedupeByKey(
                [
                    { key: 'A', value: 1 },
                    { key: 'B', value: 2 },
                    { key: 'B', value: 3 },
                    { key: 'A', value: 4 },
                ],
                byKey
            );
            expect(exampleKeys).toEqual(['A', 'B']);
            expect(rows).toEqual([
                { key: 'A', value: 4 },
                { key: 'B', value: 3 },
            ]);
        });

        it(`lists at most ${DEDUPE_EXAMPLE_LIMIT} example keys, in first-seen order`, () => {
            const keys = Array.from(
                { length: DEDUPE_EXAMPLE_LIMIT + 2 },
                (_, i) => `k${i}`
            );
            const rows = [...keys, ...keys].map((key, value) => ({
                key,
                value,
            }));
            const result = dedupeByKey(rows, byKey);
            expect(result.dropped).toBe(keys.length);
            expect(result.exampleKeys).toEqual(
                keys.slice(0, DEDUPE_EXAMPLE_LIMIT)
            );
        });
    });
});

describe('compositeKey', () => {
    it('joins the parts with the NUL separator', () => {
        expect(compositeKey('AAPL', '2026-10-16', 7)).toBe(
            ['AAPL', '2026-10-16', '7'].join(COMPOSITE_KEY_SEPARATOR)
        );
    });

    it('keeps parts that would collide under a plain join apart', () => {
        expect(compositeKey('A|B', 'C')).not.toBe(compositeKey('A', 'B|C'));
    });
});
