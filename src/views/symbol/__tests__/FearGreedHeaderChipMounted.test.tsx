import { render } from '@testing-library/react';
import { beforeAll } from 'vitest';
import { getTranslations } from 'next-intl/server';
import { sentimentLabelText } from '@/shared/lib/fearGreedLabels';
import type { EnumLabelTranslator } from '@/shared/lib/enumLabelTranslator';
import { FearGreedHeaderChipMounted } from '@/views/symbol/FearGreedHeaderChipMounted';

let t: EnumLabelTranslator;
beforeAll(async () => {
    t = await getTranslations({ locale: 'ko', namespace: 'shared.enumLabel' });
});

vi.mock('@/entities/bars/hooks/useBars', () => ({
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
        expect(getByText(sentimentLabelText('NEUTRAL', t))).toBeInTheDocument();
    });
});
