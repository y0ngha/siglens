/**
 * @jest-environment jsdom
 */
import { renderHook } from '@testing-library/react';
import {
    computeFearGreedIndex,
    type Bar,
    type BuySellVolumeResult,
} from '@y0ngha/siglens-core';
import { useFearGreed } from '@/widgets/fear-greed/hooks/useFearGreed';

jest.mock('@y0ngha/siglens-core', () => {
    const actual = jest.requireActual('@y0ngha/siglens-core');
    return {
        ...actual,
        computeFearGreedIndex: jest.fn(() => ({
            score: 18,
            label: 'EXTREME_FEAR',
            groups: [
                { name: 'Flow', score: 30, factors: [] },
                { name: 'Trend', score: 6, factors: [] },
            ],
            confidence: 'normal',
            sampleSize: 412,
            warning: null,
        })),
        computeFearGreedHistory: jest.fn(() => [
            { date: '2026-05-01', score: 22, label: 'EXTREME_FEAR' },
            { date: '2026-05-05', score: 18, label: 'EXTREME_FEAR' },
        ]),
    };
});

const fakeBars: Bar[] = [];
const fakeBsv: BuySellVolumeResult[] = [];

describe('useFearGreed', () => {
    describe('with mocked computeFearGreedIndex/History', () => {
        it('returns snapshot and history derived from bars', () => {
            const { result } = renderHook(() =>
                useFearGreed({ bars: fakeBars, buySellVolume: fakeBsv })
            );
            expect(result.current.snapshot?.label).toBe('EXTREME_FEAR');
            expect(result.current.history).toHaveLength(2);
        });

        it('returns the mocked snapshot and history shape for empty bars input', () => {
            const { result } = renderHook(() =>
                useFearGreed({ bars: [], buySellVolume: [] })
            );
            expect(result.current.snapshot?.label).toBe('EXTREME_FEAR');
            expect(result.current.history).toHaveLength(2);
        });
    });

    describe('when computeFearGreedIndex returns null', () => {
        it('returns null snapshot when computeFearGreedIndex returns null', () => {
            (computeFearGreedIndex as jest.Mock).mockReturnValueOnce(null);
            const { result } = renderHook(() =>
                useFearGreed({ bars: [], buySellVolume: [] })
            );
            expect(result.current.snapshot).toBeNull();
        });
    });
});
