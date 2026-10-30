import { describe, it, expect } from 'vitest';
import { toDisplayOrder } from '@/widgets/financials/utils/toDisplayOrder';

describe('toDisplayOrder', () => {
    it('newest→oldest 입력을 oldest→newest로 뒤집는다', () => {
        expect(toDisplayOrder([3, 2, 1])).toEqual([1, 2, 3]);
    });

    it('입력 배열을 변형하지 않는다 (non-mutating)', () => {
        const input = ['2024', '2023', '2022'];
        const result = toDisplayOrder(input);

        expect(result).toEqual(['2022', '2023', '2024']);
        expect(input).toEqual(['2024', '2023', '2022']);
        expect(result).not.toBe(input);
    });

    it('빈 배열은 빈 배열을 반환한다', () => {
        expect(toDisplayOrder([])).toEqual([]);
    });
});
