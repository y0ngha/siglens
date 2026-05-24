/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import type { FearGreedSnapshot } from '@y0ngha/siglens-core';
import { FearGreedCard } from '@/components/symbol-page/FearGreedCard';
import { WARNING_TEXT } from '@/components/fear-greed/SelfNormWarningBadge';
import {
    CONFIDENCE_LIMITED_LABEL,
    FACTOR_LABEL,
    SENTIMENT_LABEL_TEXT,
} from '@/shared/lib/fearGreedLabels';

const sample: FearGreedSnapshot = {
    score: 18.6,
    label: 'EXTREME_FEAR',
    confidence: 'normal',
    sampleSize: 412,
    warning: null,
    groups: [
        {
            name: 'Flow',
            score: 36.5,
            factors: [
                { key: 'volume_z', rawValue: -0.087, percentile: 60 },
                { key: 'buysell_imbalance', rawValue: 0.16, percentile: 55 },
                { key: 'poc_distance', rawValue: -0.0775, percentile: 5 },
            ],
        },
        {
            name: 'Trend',
            score: 0.7,
            factors: [
                { key: 'ma200_distance', rawValue: -0.185, percentile: 1 },
                { key: 'range_position', rawValue: 0.279, percentile: 2 },
            ],
        },
    ],
};

describe('FearGreedCard', () => {
    describe('with snapshot', () => {
        it('renders score, label, and group breakdown', () => {
            const { getByText } = render(<FearGreedCard snapshot={sample} />);
            expect(getByText('19')).toBeInTheDocument();
            expect(
                getByText(SENTIMENT_LABEL_TEXT.EXTREME_FEAR, { exact: false })
            ).toBeInTheDocument();
            expect(getByText('Flow')).toBeInTheDocument();
            expect(getByText('Trend')).toBeInTheDocument();
            expect(
                getByText(FACTOR_LABEL.ma200_distance, { exact: false })
            ).toBeInTheDocument();
        });

        it('renders warning badge when warning is set', () => {
            const withWarning: FearGreedSnapshot = {
                ...sample,
                warning: 'CHRONIC_WEAKNESS',
            };
            const { getByText } = render(
                <FearGreedCard snapshot={withWarning} />
            );
            expect(
                getByText(WARNING_TEXT.CHRONIC_WEAKNESS)
            ).toBeInTheDocument();
        });

        it('renders limited-confidence note', () => {
            const limited: FearGreedSnapshot = {
                ...sample,
                confidence: 'limited',
                sampleSize: 30,
            };
            const { getByText } = render(<FearGreedCard snapshot={limited} />);
            expect(
                getByText(CONFIDENCE_LIMITED_LABEL, { exact: false })
            ).toBeInTheDocument();
        });
    });

    describe('placeholder', () => {
        it('renders "데이터 부족" when snapshot is null', () => {
            const { getByText } = render(<FearGreedCard snapshot={null} />);
            expect(getByText(/데이터 부족/)).toBeInTheDocument();
        });
    });
});
