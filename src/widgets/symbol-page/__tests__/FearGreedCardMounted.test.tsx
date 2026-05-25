import { render } from '@testing-library/react';
import { FearGreedCardMounted } from '@/widgets/symbol-page/FearGreedCardMounted';
import { useBars } from '@/widgets/symbol-page/hooks/useBars';

vi.mock('@/widgets/symbol-page/hooks/useBars', () => ({
    useBars: vi.fn(() => ({
        bars: [],
        indicators: { buySellVolume: [] },
    })),
}));

vi.mock('@/widgets/fear-greed/hooks/useFearGreed', () => ({
    useFearGreed: vi.fn(() => ({
        snapshot: {
            score: 50,
            label: 'NEUTRAL',
            groups: [],
            confidence: 'normal',
            sampleSize: 100,
            warning: null,
        },
        history: [],
    })),
}));

describe('FearGreedCardMounted', () => {
    it('always fetches 1Day bars regardless of caller context', () => {
        render(<FearGreedCardMounted symbol="NVDA" />);
        expect(useBars).toHaveBeenCalledWith(
            expect.objectContaining({ symbol: 'NVDA', timeframe: '1Day' })
        );
    });

    it('renders the FearGreedCard with snapshot from useFearGreed', () => {
        const { getByText } = render(<FearGreedCardMounted symbol="NVDA" />);
        expect(getByText(/공포 탐욕 지수/)).toBeInTheDocument();
    });
});
