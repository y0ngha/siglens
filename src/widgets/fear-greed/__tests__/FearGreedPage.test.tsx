import { render } from '@testing-library/react';
import type { FearGreedSnapshot } from '@y0ngha/siglens-core';
import { FearGreedPage } from '@/widgets/fear-greed/FearGreedPage';
import {
    ShareableAnalysisProvider,
    useShareable,
} from '@/features/share/model/ShareableAnalysisContext';

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
vi.mock('@/widgets/fear-greed/FearGreedHistoricalChart', () => ({
    FearGreedHistoricalChart: () => null,
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
            // role="status" announces to screen readers that loading is in progress.
            expect(
                getByRole('status', { name: /공포 탐욕 지수 로딩 중/ })
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

            it('renders Hero score and the sample-size footer', () => {
                const { getByText, getAllByText } = render(
                    <FearGreedPage symbol="NVDA" />
                );
                // Hero focal-stack score `50` and the gauge tick label `50` both render,
                // so we expect at least 2 matches (one for the focal score, one for the tick).
                expect(getAllByText('50').length).toBeGreaterThanOrEqual(2);
                expect(
                    getByText('지난 200거래일과 비교해 매긴 점수예요.')
                ).toBeInTheDocument();
            });

            it('limited confidence swaps in the reduced-accuracy footer', () => {
                mockUseFearGreedFromSymbol.mockReturnValue({
                    snapshot: {
                        ...baseSnapshot,
                        confidence: 'limited',
                        sampleSize: 45,
                    },
                    history: [],
                });
                const { getByText } = render(<FearGreedPage symbol="NVDA" />);
                expect(
                    getByText(
                        '비교할 기록이 45거래일뿐이라 점수가 덜 정확할 수 있어요.'
                    )
                ).toBeInTheDocument();
            });

            it('hideSampleFooter removes the footer but keeps the rest', () => {
                const { queryByText, getAllByText } = render(
                    <FearGreedPage symbol="NVDA" hideSampleFooter />
                );
                expect(queryByText(/거래일/)).toBeNull();
                expect(getAllByText('50').length).toBeGreaterThanOrEqual(2);
            });

            it('renders all groups', () => {
                const { getByText } = render(<FearGreedPage symbol="NVDA" />);
                expect(getByText('수급 그룹')).toBeInTheDocument();
                expect(getByText('추세 그룹')).toBeInTheDocument();
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

        /**
         * fear-greed is deterministic (no async analysis job), so the
         * registered `trigger` is a no-op — but `ShareButton` always calls it
         * on click regardless of kind. This verifies the real user-visible
         * contract: calling the registered trigger is safe (doesn't throw)
         * and doesn't mutate the already-rendered snapshot UI.
         */
        describe('share registration trigger', () => {
            beforeEach(() => {
                mockUseFearGreedFromSymbol.mockReturnValue({
                    snapshot: baseSnapshot,
                    history: [],
                });
            });

            function ShareTriggerProbe() {
                const shareable = useShareable();
                return (
                    <button type="button" onClick={() => shareable?.trigger()}>
                        invoke-trigger
                    </button>
                );
            }

            it('registers a no-op trigger that is safe to call and leaves the snapshot UI unchanged', () => {
                const { getByText, getByRole } = render(
                    <ShareableAnalysisProvider>
                        <FearGreedPage symbol="NVDA" />
                        <ShareTriggerProbe />
                    </ShareableAnalysisProvider>
                );

                expect(
                    getByText('지난 200거래일과 비교해 매긴 점수예요.')
                ).toBeInTheDocument();
                expect(() =>
                    getByRole('button', { name: 'invoke-trigger' }).click()
                ).not.toThrow();
                // Trigger is a pure no-op — the same snapshot text still renders.
                expect(
                    getByText('지난 200거래일과 비교해 매긴 점수예요.')
                ).toBeInTheDocument();
            });
        });

        describe('limited confidence', () => {
            it('renders limited confidence note', () => {
                mockUseFearGreedFromSymbol.mockReturnValue({
                    snapshot: { ...baseSnapshot, confidence: 'limited' },
                    history: [],
                });
                const { getAllByText, getByText } = render(
                    <FearGreedPage symbol="NVDA" />
                );
                // 배지('신뢰도 제한')와 하단 안내문이 함께 제한 상태를 알린다.
                expect(
                    getAllByText(/신뢰도 제한/).length
                ).toBeGreaterThanOrEqual(1);
                expect(
                    getByText(/점수가 덜 정확할 수 있어요/)
                ).toBeInTheDocument();
            });
        });
    });
});
