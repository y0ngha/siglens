import { isSameQueryKey } from '@/widgets/overall/utils/isSameQueryKey';

describe('isSameQueryKey', () => {
    it('요소가 모두 같으면 참이다', () => {
        expect(isSameQueryKey(['a', 'AAPL', false], ['a', 'AAPL', false])).toBe(
            true
        );
    });

    it('요소 하나가 다르면 거짓이다', () => {
        expect(isSameQueryKey(['a', 'gemini'], ['a', 'claude'])).toBe(false);
    });

    it('짧은 쪽이 긴 쪽의 접두사여도 거짓이다', () => {
        expect(isSameQueryKey(['a'], ['a', 'b'])).toBe(false);
        expect(isSameQueryKey(['a', 'b'], ['a'])).toBe(false);
    });
});
