import { vi } from 'vitest';
import { render } from '@testing-library/react';
import type { FearGreedSnapshot } from '@y0ngha/siglens-core';
import { FearGreedPage } from '@/widgets/fear-greed/FearGreedPage';

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

const mockUseFearGreedFromSymbol = vi.fn();
vi.mock('@/widgets/fear-greed/hooks/useFearGreedFromSymbol', () => ({
    useFearGreedFromSymbol: (...args: unknown[]) =>
        mockUseFearGreedFromSymbol(...args),
}));

// Mock the chart subcomponent (it uses lightweight-charts and is hard to render under jsdom).
vi.mock('@/widgets/chart/FearGreedHistoricalChart', () => ({
    FearGreedHistoricalChart: () => null,
}));

vi.mock('@/features/symbol-chat', () => ({
    usePublishSymbolChat: () => undefined,
}));

describe('FearGreedPage', () => {
    describe('with snapshot', () => {
        beforeEach(() => {
            mockUseFearGreedFromSymbol.mockReturnValue({
                snapshot: baseSnapshot,
                history: [],
            });
        });

        it('renders Hero score and confidence footer', () => {
            const { getByText, getAllByText } = render(
                <FearGreedPage symbol="NVDA" />
            );
            // Hero focal-stack score `50` and the gauge tick label `50` both render,
            // so we expect at least 2 matches (one for the focal score, one for the tick).
            expect(getAllByText('50').length).toBeGreaterThanOrEqual(2);
            expect(getByText(/표본 200/)).toBeInTheDocument();
            expect(getByText(/정상 산출/)).toBeInTheDocument();
        });

        it('renders all groups', () => {
            const { getByText } = render(<FearGreedPage symbol="NVDA" />);
            expect(getByText('Flow Group')).toBeInTheDocument();
            expect(getByText('Trend Group')).toBeInTheDocument();
        });
    });

    describe('without snapshot', () => {
        it('renders insufficient-data placeholder', () => {
            mockUseFearGreedFromSymbol.mockReturnValue({
                snapshot: null,
                history: [],
            });
            const { getByText } = render(<FearGreedPage symbol="NVDA" />);
            expect(
                getByText(/공포 탐욕 지수 산출에 필요한 데이터가 부족합니다/)
            ).toBeInTheDocument();
        });
    });

    describe('limited confidence', () => {
        it('renders limited confidence note', () => {
            mockUseFearGreedFromSymbol.mockReturnValue({
                snapshot: { ...baseSnapshot, confidence: 'limited' },
                history: [],
            });
            const { getAllByText } = render(<FearGreedPage symbol="NVDA" />);
            // '신뢰도 제한'은 뱃지와 푸터 두 곳에 렌더링되므로 getAllByText로 확인한다.
            expect(getAllByText(/신뢰도 제한/).length).toBeGreaterThanOrEqual(
                2
            );
        });
    });
});
