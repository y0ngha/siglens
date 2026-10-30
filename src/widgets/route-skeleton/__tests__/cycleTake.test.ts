import { cycleTake } from '../utils/cycleTake';

describe('cycleTake', () => {
    it('목록보다 적게 고르면 앞에서부터 자른다', () => {
        expect(cycleTake(['a', 'b', 'c'], 2)).toEqual(['a', 'b']);
    });

    it('목록보다 많이 고르면 처음부터 되풀이한다', () => {
        expect(cycleTake(['a', 'b'], 5)).toEqual(['a', 'b', 'a', 'b', 'a']);
    });

    it('개수가 0 이하면 빈 배열이다', () => {
        expect(cycleTake(['a'], 0)).toEqual([]);
        expect(cycleTake(['a'], -1)).toEqual([]);
    });

    it('빈 목록이면 개수와 상관없이 빈 배열이다', () => {
        expect(cycleTake([], 3)).toEqual([]);
    });
});
