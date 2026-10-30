import { describe, expect, it } from 'vitest';
import { railScrollLeftFor } from '../../utils/tabRailScroll';

describe('railScrollLeftFor', () => {
    const rail = { scrollLeft: 100, clientWidth: 300 };

    it('탭이 레일 안에 다 보이면 null이다', () => {
        expect(railScrollLeftFor({ left: 150, width: 80 }, rail)).toBeNull();
    });

    it('탭이 레일 양 끝에 정확히 닿아도 보이는 것으로 친다', () => {
        expect(railScrollLeftFor({ left: 100, width: 300 }, rail)).toBeNull();
    });

    it('왼쪽으로 벗어나면 탭 왼쪽 끝을 레일 왼쪽에 붙인다', () => {
        expect(railScrollLeftFor({ left: 40, width: 80 }, rail)).toBe(40);
    });

    it('오른쪽으로 벗어나면 탭 오른쪽 끝을 레일 오른쪽에 붙인다', () => {
        // 탭 오른쪽 끝 581 + 72 = 653, 레일 폭 300 → 353.
        expect(railScrollLeftFor({ left: 581, width: 72 }, rail)).toBe(353);
    });
});
