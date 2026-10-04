import { render } from '@testing-library/react';
import { beforeAll } from 'vitest';
import { getTranslations } from 'next-intl/server';
import type { FearGreedSnapshot } from '@y0ngha/siglens-core';
import { FearGreedHero } from '@/widgets/fear-greed/FearGreedHero';
import { sentimentLabelText } from '@/shared/lib/fearGreedLabels';
import type { EnumLabelTranslator } from '@/shared/lib/enumLabelTranslator';

let t: EnumLabelTranslator;
beforeAll(async () => {
    t = await getTranslations({ locale: 'ko', namespace: 'shared.enumLabel' });
});

const snapshot: FearGreedSnapshot = {
    score: 18,
    label: 'EXTREME_FEAR',
    confidence: 'normal',
    sampleSize: 412,
    warning: null,
    groups: [],
};

describe('FearGreedHero', () => {
    describe('with EXTREME_FEAR snapshot', () => {
        it('renders score and label', () => {
            const { getByText } = render(<FearGreedHero snapshot={snapshot} />);
            expect(getByText('18')).toBeInTheDocument();
            expect(
                getByText(sentimentLabelText('EXTREME_FEAR', t))
            ).toBeInTheDocument();
        });

        it('renders SVG with aria-label including score and label', () => {
            const { container } = render(<FearGreedHero snapshot={snapshot} />);
            const svg = container.querySelector('svg[role="img"]');
            expect(svg?.getAttribute('aria-label')).toContain('18');
            expect(svg?.getAttribute('aria-label')).toContain(
                sentimentLabelText('EXTREME_FEAR', t)
            );
        });
    });

    describe('rounding', () => {
        it('rounds the score for display', () => {
            const { getByText } = render(
                <FearGreedHero snapshot={{ ...snapshot, score: 67.6 }} />
            );
            expect(getByText('68')).toBeInTheDocument();
        });
    });

    describe('with GREED snapshot', () => {
        it('renders GREED label for score 60', () => {
            const greedSnap: FearGreedSnapshot = {
                score: 60,
                label: 'GREED',
                confidence: 'normal',
                sampleSize: 200,
                warning: null,
                groups: [],
            };
            const { getByText } = render(
                <FearGreedHero snapshot={greedSnap} />
            );
            expect(getByText('60')).toBeInTheDocument();
            expect(
                getByText(sentimentLabelText('GREED', t))
            ).toBeInTheDocument();
        });
    });
});
