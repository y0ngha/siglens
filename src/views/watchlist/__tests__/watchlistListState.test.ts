import { isWatchlistListPending } from '../lib/watchlistListState';

describe('isWatchlistListPending', () => {
    it('하이드레이션 전이면 항목이 있어도 아직 모름이다', () => {
        expect(
            isWatchlistListPending({
                isHydrated: false,
                isIdentityPending: false,
                itemCount: 3,
            })
        ).toBe(true);
    });

    it('회원 여부를 모르는 동안의 빈 목록은 아직 모름이다', () => {
        expect(
            isWatchlistListPending({
                isHydrated: true,
                isIdentityPending: true,
                itemCount: 0,
            })
        ).toBe(true);
    });

    it('회원 여부를 몰라도 항목이 있으면 확정이다', () => {
        expect(
            isWatchlistListPending({
                isHydrated: true,
                isIdentityPending: true,
                itemCount: 2,
            })
        ).toBe(false);
    });

    it('회원 여부가 정해진 빈 목록은 확정이다(빈 상태를 그린다)', () => {
        expect(
            isWatchlistListPending({
                isHydrated: true,
                isIdentityPending: false,
                itemCount: 0,
            })
        ).toBe(false);
    });
});
