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

const { mockUseFearGreedFromSymbol, mockUseHydrated } = vi.hoisted(() => ({
    mockUseFearGreedFromSymbol: vi.fn(),
    mockUseHydrated: vi.fn(),
}));
vi.mock('@/widgets/fear-greed/hooks/useFearGreedFromSymbol', () => ({
    useFearGreedFromSymbol: (...args: unknown[]) =>
        mockUseFearGreedFromSymbol(...args),
}));

vi.mock('@/shared/hooks/useHydrated', () => ({
    useHydrated: () => mockUseHydrated(),
}));

// Mock the chart subcomponent (it uses lightweight-charts and is hard to render under jsdom).
vi.mock('@/widgets/chart/FearGreedHistoricalChart', () => ({
    FearGreedHistoricalChart: () => null,
}));

vi.mock('@/features/symbol-chat', () => ({
    usePublishSymbolChat: () => undefined,
}));

describe('FearGreedPage', () => {
    describe('before hydration (isHydrated=false)', () => {
        beforeEach(() => {
            mockUseHydrated.mockReturnValue(false);
            mockUseFearGreedFromSymbol.mockReturnValue({
                snapshot: baseSnapshot,
                history: [],
            });
        });

        it('renders loading skeleton — no score text visible', () => {
            const { queryByText, getByRole } = render(
                <FearGreedPage symbol="BTCUSD" />
            );
            // Score and label must NOT be in the DOM during SSR/first render.
            // This prevents React #418 for crypto (forming-bar divergence).
            expect(queryByText('50')).toBeNull();
            expect(queryByText(/탐욕|공포|중립/)).toBeNull();
            // Accessible busy state while loading
            expect(
                getByRole('generic', { name: /공포 탐욕 지수 로딩 중/ })
            ).toBeInTheDocument();
        });

        it('still renders skeleton even when snapshot is null (no #418 on null path)', () => {
            mockUseFearGreedFromSymbol.mockReturnValue({
                snapshot: null,
                history: [],
            });
            const { queryByText } = render(<FearGreedPage symbol="BTCUSD" />);
            // Insufficient-data text must NOT appear before hydration either.
            expect(
                queryByText(/공포 탐욕 지수 산출에 필요한 데이터가 부족합니다/)
            ).toBeNull();
        });
    });

    describe('after hydration (isHydrated=true)', () => {
        beforeEach(() => {
            mockUseHydrated.mockReturnValue(true);
        });

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
                    getByText(
                        /공포 탐욕 지수 산출에 필요한 데이터가 부족합니다/
                    )
                ).toBeInTheDocument();
            });
        });

        describe('limited confidence', () => {
            it('renders limited confidence note', () => {
                mockUseFearGreedFromSymbol.mockReturnValue({
                    snapshot: { ...baseSnapshot, confidence: 'limited' },
                    history: [],
                });
                const { getAllByText } = render(
                    <FearGreedPage symbol="NVDA" />
                );
                // '신뢰도 제한'은 뱃지와 푸터 두 곳에 렌더링되므로 getAllByText로 확인한다.
                expect(
                    getAllByText(/신뢰도 제한/).length
                ).toBeGreaterThanOrEqual(2);
            });
        });
    });
});
