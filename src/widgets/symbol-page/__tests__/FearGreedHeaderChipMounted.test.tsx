import { render } from '@testing-library/react';
import { SENTIMENT_LABEL_TEXT } from '@/shared/lib/fearGreedLabels';
import { FearGreedHeaderChipMounted } from '@/widgets/symbol-page/FearGreedHeaderChipMounted';

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

describe('FearGreedHeaderChipMounted', () => {
    it('renders the FearGreedHeaderChip with snapshot from useFearGreed', () => {
        const { getByText } = render(
            <FearGreedHeaderChipMounted symbol="NVDA" />
        );
        expect(getByText(SENTIMENT_LABEL_TEXT.NEUTRAL)).toBeInTheDocument();
    });
});
