/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';

jest.mock('@/components/symbol-page/hooks/useBars', () => ({
    useBars: jest.fn(() => ({
        bars: [],
        indicators: { buySellVolume: [] },
    })),
}));

jest.mock('@/components/symbol-page/hooks/useFearGreed', () => ({
    useFearGreed: jest.fn(() => ({
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

import { FearGreedHeaderChipMounted } from '@/components/symbol-page/FearGreedHeaderChipMounted';

describe('FearGreedHeaderChipMounted', () => {
    it('renders the FearGreedHeaderChip with snapshot from useFearGreed', () => {
        const { getByText } = render(
            <FearGreedHeaderChipMounted symbol="NVDA" />
        );
        expect(getByText(/중립/)).toBeInTheDocument();
    });
});
