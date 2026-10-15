import { sparklinePoints } from '@/features/watchlist/lib/sparklinePoints';

describe('sparklinePoints', () => {
    it('첫 점은 왼쪽 끝, 마지막 점은 오른쪽 끝이고 큰 값일수록 위에 있다', () => {
        const points = sparklinePoints([1, 3]).split(' ');
        expect(points).toEqual(['0.0,22.0', '64.0,2.0']);
    });

    it('값이 모두 같으면 가운데 수평선', () => {
        expect(sparklinePoints([5, 5, 5])).toBe('0.0,12.0 32.0,12.0 64.0,12.0');
    });
});
