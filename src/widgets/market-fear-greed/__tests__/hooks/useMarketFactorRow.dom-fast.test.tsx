import { renderHook } from '@testing-library/react';
import { useMarketFactorRow } from '@/widgets/market-fear-greed/hooks/useMarketFactorRow';
import koMessages from '@/../messages/ko.json';

const FG = koMessages.shared.lib.fearGreedFactor;

describe('useMarketFactorRow', () => {
    describe('with a US junk-bond factor', () => {
        const factor = { key: 'junk_bond', rawValue: 0.0123, percentile: 64.6 };

        it('resolves the market-specific label', () => {
            const { result } = renderHook(() =>
                useMarketFactorRow(factor, 'us')
            );
            expect(result.current.label).toBe(FG.label.junk_bond_us);
        });

        it('resolves the market-specific description', () => {
            const { result } = renderHook(() =>
                useMarketFactorRow(factor, 'us')
            );
            expect(result.current.description).toBe(FG.descriptionUs.junk_bond);
        });

        it('rounds the percentile once to an integer', () => {
            const { result } = renderHook(() =>
                useMarketFactorRow(factor, 'us')
            );
            expect(result.current.percentile).toBe(65);
        });

        it('formats the raw value as a signed percentage', () => {
            const { result } = renderHook(() =>
                useMarketFactorRow(factor, 'us')
            );
            expect(result.current.rawValueText).toBe('+1.23%');
        });
    });

    describe('with a KR junk-bond factor', () => {
        it('uses the credit-spread label instead of high-yield', () => {
            const { result } = renderHook(() =>
                useMarketFactorRow(
                    { key: 'junk_bond', rawValue: 0.01, percentile: 50 },
                    'kr'
                )
            );
            expect(result.current.label).toBe(FG.label.junk_bond_kr);
        });
    });

    describe('with a crypto share factor', () => {
        it('formats the raw value without a sign', () => {
            const { result } = renderHook(() =>
                useMarketFactorRow(
                    { key: 'alt_season', rawValue: 0.3, percentile: 40 },
                    'crypto'
                )
            );
            expect(result.current.rawValueText).toBe('30.00%');
        });
    });
});
