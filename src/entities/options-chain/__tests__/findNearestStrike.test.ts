import { findNearestStrikeIndex } from '@/entities/options-chain/lib/findNearestStrike';

describe('findNearestStrikeIndex', () => {
    it('빈 배열에 대해 -1을 반환한다', () => {
        expect(findNearestStrikeIndex([], 100)).toBe(-1);
    });

    it('가장 가까운 strike의 index를 반환한다', () => {
        const strikes = [90, 95, 100, 105, 110];
        expect(findNearestStrikeIndex(strikes, 102)).toBe(2); // 100
    });

    it('정확히 일치하는 strike의 index를 반환한다', () => {
        const strikes = [90, 95, 100, 105];
        expect(findNearestStrikeIndex(strikes, 95)).toBe(1);
    });

    it('두 strike와 등거리일 때 더 낮은 index가 우선한다 (첫 매치)', () => {
        // 100과 110, target=105 → 100, 110 모두 거리 5. 첫 발견 100이 우선.
        const strikes = [100, 110];
        expect(findNearestStrikeIndex(strikes, 105)).toBe(0);
    });

    it('단일 strike 배열은 0을 반환한다', () => {
        expect(findNearestStrikeIndex([42], 100)).toBe(0);
    });

    it('target이 모든 strike보다 작으면 가장 작은 strike의 index를 반환한다', () => {
        expect(findNearestStrikeIndex([90, 95, 100], 50)).toBe(0);
    });

    it('target이 모든 strike보다 크면 가장 큰 strike의 index를 반환한다', () => {
        expect(findNearestStrikeIndex([90, 95, 100], 200)).toBe(2);
    });
});
