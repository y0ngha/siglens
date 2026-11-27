import {
    COLLAPSED_VISIBLE,
    expandButtonVisibility,
} from '../../utils/popularCollapse';

describe('expandButtonVisibility', () => {
    it('lg에서 보이는 수를 넘으면 모든 너비에서 버튼을 보인다', () => {
        expect(expandButtonVisibility(COLLAPSED_VISIBLE.lg + 1)).toBe('');
        expect(expandButtonVisibility(10)).toBe('');
    });

    it('lg에서는 모두 보이고 md에서는 숨는 카드가 있으면 lg 이상에서 버튼을 숨긴다', () => {
        expect(expandButtonVisibility(COLLAPSED_VISIBLE.lg)).toBe('lg:hidden');
        expect(expandButtonVisibility(COLLAPSED_VISIBLE.md + 1)).toBe(
            'lg:hidden'
        );
    });

    it('md에서도 모두 보이고 모바일에서만 숨는 카드가 있으면 md 이상에서 버튼을 숨긴다', () => {
        expect(expandButtonVisibility(COLLAPSED_VISIBLE.md)).toBe('md:hidden');
        expect(expandButtonVisibility(COLLAPSED_VISIBLE.base + 1)).toBe(
            'md:hidden'
        );
    });

    it('어느 너비에서도 숨는 카드가 없으면 버튼을 그리지 않는다', () => {
        expect(expandButtonVisibility(COLLAPSED_VISIBLE.base)).toBeNull();
        expect(expandButtonVisibility(2)).toBeNull();
        expect(expandButtonVisibility(0)).toBeNull();
    });
});
