import { getListboxNextIndex } from '@/shared/ui/modelListboxNav';

describe('getListboxNextIndex', () => {
    it.each([
        ['ArrowDown', 0, 3, 1],
        ['ArrowDown', 2, 3, 0],
        ['ArrowDown', -1, 3, 0],
        ['ArrowUp', 1, 3, 0],
        ['ArrowUp', 0, 3, 2],
        ['Home', 2, 3, 0],
        ['End', 0, 3, 2],
    ])('%s at %i of %i -> %i', (key, current, count, expected) => {
        expect(getListboxNextIndex(key, current, count)).toBe(expected);
    });

    it('선택이 목록에 없을 때 ArrowUp은 마지막 항목으로 간다', () => {
        expect(getListboxNextIndex('ArrowUp', -1, 4)).toBe(3);
    });

    it('처리하지 않는 키는 null이다', () => {
        expect(getListboxNextIndex('a', 0, 3)).toBeNull();
    });

    it('빈 목록이면 null이다', () => {
        expect(getListboxNextIndex('ArrowDown', -1, 0)).toBeNull();
    });
});
