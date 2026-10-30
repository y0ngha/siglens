import { describe, expect, it } from 'vitest';
import { presentLines } from '../../../utils/axis-evidence/evidenceLine';

describe('presentLines', () => {
    it('null인 줄을 빼고 나머지를 순서대로 돌려준다', () => {
        expect(
            presentLines([
                { id: 'a', values: {} },
                null,
                { id: 'b', values: { n: '1' } },
            ])
        ).toEqual([
            { id: 'a', values: {} },
            { id: 'b', values: { n: '1' } },
        ]);
    });

    it('모두 null이면 빈 배열이다', () => {
        expect(presentLines([null, null])).toEqual([]);
    });
});
