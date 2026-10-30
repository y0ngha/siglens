/**
 * shareHasOptionsTab — `overall` 공유 패널이 `OverallView.hasOptions`에 넘기는 판정.
 */

import { shareHasOptionsTab } from '@/views/share/lib/shareHasOptionsTab';

describe('shareHasOptionsTab', () => {
    it('returns true for a us-equity symbol (profile has the options tab)', () => {
        expect(shareHasOptionsTab('AAPL')).toBe(true);
    });

    it('returns false for a kr-equity symbol (profile has no options tab)', () => {
        expect(shareHasOptionsTab('005930.KS')).toBe(false);
    });

    // 모르는 상태를 `true`로 열면 존재하지 않는 옵션 섹션이 뜬다 — 숨기는 쪽이 대가가 작다.
    it('returns false when the symbol is undefined', () => {
        expect(shareHasOptionsTab(undefined)).toBe(false);
    });

    // `profileIdForSymbol('')`은 us-equity로 폴백하므로, 게이트가 없으면 `true`가 된다.
    it('returns false for an empty-string symbol', () => {
        expect(shareHasOptionsTab('')).toBe(false);
    });
});
