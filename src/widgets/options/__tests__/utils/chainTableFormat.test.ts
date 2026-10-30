import {
    formatBidAsk,
    formatIv,
    formatOi,
    formatStrike,
} from '@/widgets/options/utils/chainTableFormat';

describe('chainTableFormat', () => {
    describe('formatOi', () => {
        it('groups thousands with en-US separators', () => {
            expect(formatOi(1234567)).toBe('1,234,567');
        });
    });

    describe('formatIv', () => {
        it('formats a fraction as a one-decimal percent', () => {
            expect(formatIv(0.3512)).toBe('35.1%');
        });

        it('shows a dash for null', () => {
            expect(formatIv(null)).toBe('-');
        });
    });

    describe('formatBidAsk', () => {
        it('formats both sides as dollars', () => {
            expect(formatBidAsk(1234.5, 1240)).toBe('$1,234.50/$1,240.00');
        });

        it('shows a dash per missing side', () => {
            expect(formatBidAsk(0.5, null)).toBe('$0.50/-');
            expect(formatBidAsk(null, 0.6)).toBe('-/$0.60');
        });

        it('collapses to a single dash when both sides are missing', () => {
            expect(formatBidAsk(null, null)).toBe('-');
        });
    });

    describe('formatStrike', () => {
        it('drops decimals for whole strikes', () => {
            expect(formatStrike(1050)).toBe('$1,050');
        });

        it('keeps one decimal for fractional strikes', () => {
            expect(formatStrike(102.5)).toBe('$102.5');
        });
    });
});
