import { render } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { IntlTestProvider } from '@/shared/test-utils/intlRenderWrapper';
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

const { mockUseFearGreedFromSymbol } = vi.hoisted(() => ({
    mockUseFearGreedFromSymbol: vi.fn(),
}));
vi.mock('@/widgets/fear-greed/hooks/useFearGreedFromSymbol', () => ({
    useFearGreedFromSymbol: (...args: unknown[]) =>
        mockUseFearGreedFromSymbol(...args),
}));

// Mock the chart subcomponent (it uses lightweight-charts and is hard to render under jsdom).
vi.mock('@/widgets/fear-greed/FearGreedHistoricalChart', () => ({
    FearGreedHistoricalChart: () => null,
}));

describe('FearGreedPage', () => {
    /**
     * 게이지·칩·그룹은 서버 seed로 SSR된다 — 예전의 하이드레이션 게이트(점수 없는
     * 스켈레톤)는 없다. 재조회가 사람 입력 이후로 미뤄져 하이드레이션 렌더가 SSR과
     * 같은 seed를 읽으므로 #418 위험이 없다(`FearGreedPage` 본문 주석).
     */
    describe('server render (renderToString)', () => {
        beforeEach(() => {
            mockUseFearGreedFromSymbol.mockReturnValue({
                snapshot: baseSnapshot,
                history: [],
            });
        });

        function renderServerHtml(): string {
            return renderToString(
                <IntlTestProvider>
                    <FearGreedPage symbol="BTCUSD" />
                </IntlTestProvider>
            );
        }

        it('점수와 라벨 칩을 서버 HTML에 싣는다', () => {
            const html = renderServerHtml();
            expect(html).toContain('>50<');
            expect(html).toContain('중립');
        });

        it('그룹 막대를 서버 HTML에 싣는다', () => {
            const html = renderServerHtml();
            expect(html).toContain('수급 그룹');
            expect(html).toContain('추세 그룹');
        });

        it('로딩 스켈레톤(status)을 내지 않는다', () => {
            const html = renderServerHtml();
            expect(html).not.toContain('role="status"');
            expect(html).not.toContain('aria-busy="true"');
        });
    });

    /**
     * 서버 봉 조회가 실패해 seed가 없으면(`hasSeed={false}`) 서버 렌더에서 쿼리 훅을 부르지
     * 않는다 — 훅의 `useSuspenseQuery`가 Server Function을 서버 렌더 중에 불러 페이지가 500이
     * 되던 경로다(2026-10-07 운영 `/[symbol]/fear-greed`).
     */
    describe('without server seed (hasSeed=false)', () => {
        beforeEach(() => {
            mockUseFearGreedFromSymbol.mockClear();
            mockUseFearGreedFromSymbol.mockReturnValue({
                snapshot: baseSnapshot,
                history: [],
            });
        });

        it('서버 렌더는 쿼리 훅을 부르지 않고 스켈레톤만 낸다', () => {
            const html = renderToString(
                <IntlTestProvider>
                    <FearGreedPage symbol="ATGSF" hasSeed={false} />
                </IntlTestProvider>
            );
            expect(mockUseFearGreedFromSymbol).not.toHaveBeenCalled();
            expect(html).toContain('role="status"');
            expect(html).toContain('aria-busy="true"');
            expect(html).not.toContain('>50<');
        });

        it('브라우저 렌더에서는 쿼리를 마운트해 점수를 그린다', () => {
            const { getAllByText } = render(
                <FearGreedPage symbol="ATGSF" hasSeed={false} />
            );
            expect(mockUseFearGreedFromSymbol).toHaveBeenCalledWith(
                expect.objectContaining({ symbol: 'ATGSF' })
            );
            expect(getAllByText('50').length).toBeGreaterThan(0);
        });
    });

    describe('client render', () => {
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
