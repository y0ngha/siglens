import {
    countReportSymbols,
    isInReportSet,
} from '@/features/email-report-nudge/lib/reportSet';

describe('countReportSymbols', () => {
    it('보유와 관심 종목을 합쳐 센다', () => {
        expect(
            countReportSymbols([{ symbol: 'AAPL' }], [{ symbol: 'TSLA' }])
        ).toBe(2);
    });

    it('두 목록에 모두 있는 종목은 대소문자와 상관없이 한 번만 센다', () => {
        expect(
            countReportSymbols([{ symbol: 'aapl' }], [{ symbol: 'AAPL' }])
        ).toBe(1);
    });

    it('둘 다 비면 0', () => {
        expect(countReportSymbols([], [])).toBe(0);
    });
});

describe('isInReportSet', () => {
    const notWatched = (): boolean => false;

    it('보유종목에 있으면 대소문자와 상관없이 true', () => {
        expect(isInReportSet('aapl', [{ symbol: 'AAPL' }], notWatched)).toBe(
            true
        );
    });

    it('관심종목에 있으면 true', () => {
        expect(isInReportSet('TSLA', [], () => true)).toBe(true);
    });

    it('관심종목 판정에는 대문자 심볼을 넘긴다', () => {
        const isWatched = vi.fn(() => false);

        isInReportSet('tsla', [], isWatched);

        expect(isWatched).toHaveBeenCalledWith('TSLA');
    });

    it('어느 쪽에도 없으면 false', () => {
        expect(isInReportSet('NVDA', [{ symbol: 'AAPL' }], notWatched)).toBe(
            false
        );
    });
});
