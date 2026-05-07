/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import type { FearGreedSnapshot } from '@y0ngha/siglens-core';

const baseSnapshot: FearGreedSnapshot = {
    score: 50,
    label: 'NEUTRAL',
    groups: [
        { name: 'Flow', score: 45, factors: [] },
        { name: 'Trend', score: 55, factors: [] },
    ],
    confidence: 'normal',
    sampleSize: 200,
    warning: null,
};

jest.mock('@/components/symbol-page/hooks/useBars', () => ({
    useBars: jest.fn(() => ({
        bars: [],
        indicators: { buySellVolume: [] },
    })),
}));

const mockUseFearGreed = jest.fn();
jest.mock('@/components/fear-greed/hooks/useFearGreed', () => ({
    useFearGreed: (...args: unknown[]) => mockUseFearGreed(...args),
}));

// Mock the chart subcomponent (it uses lightweight-charts and is hard to render under jsdom).
jest.mock('@/components/chart/FearGreedHistoricalChart', () => ({
    FearGreedHistoricalChart: () => null,
}));

import { FearGreedPage } from '@/components/fear-greed/FearGreedPage';

describe('FearGreedPage', () => {
    describe('with snapshot', () => {
        beforeEach(() => {
            mockUseFearGreed.mockReturnValue({
                snapshot: baseSnapshot,
                history: [],
            });
        });

        it('renders Hero score and confidence footer', () => {
            const { getByText } = render(
                <FearGreedPage
                    symbol="NVDA"
                    displayName="엔비디아, NVIDIA Corp"
                />
            );
            expect(getByText('50')).toBeInTheDocument();
            expect(getByText(/표본 200/)).toBeInTheDocument();
            expect(getByText(/정상 산출/)).toBeInTheDocument();
        });

        it('renders all groups', () => {
            const { getByText } = render(
                <FearGreedPage
                    symbol="NVDA"
                    displayName="엔비디아, NVIDIA Corp"
                />
            );
            expect(getByText('Flow Group')).toBeInTheDocument();
            expect(getByText('Trend Group')).toBeInTheDocument();
        });
    });

    describe('without snapshot', () => {
        it('renders insufficient-data placeholder', () => {
            mockUseFearGreed.mockReturnValue({
                snapshot: null,
                history: [],
            });
            const { getByText } = render(
                <FearGreedPage
                    symbol="NVDA"
                    displayName="엔비디아, NVIDIA Corp"
                />
            );
            expect(
                getByText(/공포·탐욕 지수 산출에 필요한 데이터가 부족합니다/)
            ).toBeInTheDocument();
        });
    });

    describe('limited confidence', () => {
        it('renders limited confidence note', () => {
            mockUseFearGreed.mockReturnValue({
                snapshot: { ...baseSnapshot, confidence: 'limited' },
                history: [],
            });
            const { getByText } = render(
                <FearGreedPage
                    symbol="NVDA"
                    displayName="엔비디아, NVIDIA Corp"
                />
            );
            expect(getByText(/신뢰도 제한/)).toBeInTheDocument();
        });
    });
});
