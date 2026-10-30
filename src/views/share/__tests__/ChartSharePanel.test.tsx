/**
 * ChartSharePanel — the read-only `chart` kind panel.
 *
 * Both widgets load through `next/dynamic`, so assertions on the widget mocks
 * wait for the lazily loaded module.
 */

import { render, waitFor } from '@testing-library/react';
import type { Bar, KeyLevels } from '@y0ngha/siglens-core';
import { ChartSharePanel } from '@/views/share/ui/chart/ChartSharePanel';
import { toShareKeyLevels } from '@/views/share/lib/shareKeyLevels';

const mockAnalysisPanel = vi.fn((_props: Record<string, unknown>) => null);
const mockShareCandlestickChart = vi.fn(
    (_props: Record<string, unknown>) => null
);

vi.mock('@/widgets/analysis/AnalysisPanel', () => ({
    AnalysisPanel: (props: Record<string, unknown>) => mockAnalysisPanel(props),
}));
// ShareCandlestickChart uses lightweight-charts, which needs a real canvas.
vi.mock('@/widgets/chart/ShareCandlestickChart', () => ({
    ShareCandlestickChart: (props: Record<string, unknown>) =>
        mockShareCandlestickChart(props),
}));

const STUB_BARS: Bar[] = [
    {
        time: 1700000000,
        open: 150,
        high: 155,
        low: 148,
        close: 153,
        volume: 1000000,
    },
];

describe('ChartSharePanel', () => {
    beforeEach(() => {
        mockAnalysisPanel.mockClear();
        mockShareCandlestickChart.mockClear();
    });

    it('passes the clustered snapshot key levels, ticker and share defaults to AnalysisPanel', async () => {
        const rawKeyLevels: KeyLevels = {
            support: [{ price: 100, reason: '지지선' }],
            resistance: [{ price: 200, reason: '저항선' }],
        };
        const fakeResult = {
            trend: 'bullish',
            summary: '상승 추세',
            keyLevels: rawKeyLevels,
        };
        render(<ChartSharePanel result={fakeResult as never} symbol="AAPL" />);
        await waitFor(() =>
            expect(mockAnalysisPanel).toHaveBeenCalledWith(
                expect.objectContaining({
                    analysis: fakeResult,
                    keyLevels: toShareKeyLevels(rawKeyLevels),
                    timeframe: '1Day',
                    isFreeUser: false,
                    symbol: 'AAPL',
                })
            )
        );
    });

    it('passes no interaction handlers to AnalysisPanel', async () => {
        render(<ChartSharePanel result={{} as never} symbol="AAPL" />);
        await waitFor(() => expect(mockAnalysisPanel).toHaveBeenCalled());
        const props = mockAnalysisPanel.mock.lastCall?.[0];
        expect(props).not.toHaveProperty('onReanalyze');
        expect(props).not.toHaveProperty('onActionPricesVisibilityChange');
    });

    it('passes the empty clustered structure when the snapshot has no keyLevels', async () => {
        render(<ChartSharePanel result={{} as never} symbol="AAPL" />);
        await waitFor(() =>
            expect(mockAnalysisPanel).toHaveBeenCalledWith(
                expect.objectContaining({
                    keyLevels: { support: [], resistance: [], poc: undefined },
                })
            )
        );
    });

    it('uses an empty ticker when symbol is omitted', async () => {
        render(<ChartSharePanel result={{} as never} />);
        await waitFor(() =>
            expect(mockAnalysisPanel).toHaveBeenCalledWith(
                expect.objectContaining({ symbol: '' })
            )
        );
    });

    it('forwards plain and krxTickTable to AnalysisPanel', async () => {
        render(
            <ChartSharePanel
                result={{} as never}
                symbol="005930.KS"
                krxTickTable="etp"
                plain="차트를 쉬운 말로 풀어 쓴 설명입니다."
            />
        );
        await waitFor(() =>
            expect(mockAnalysisPanel).toHaveBeenCalledWith(
                expect.objectContaining({
                    krxTickTable: 'etp',
                    plain: '차트를 쉬운 말로 풀어 쓴 설명입니다.',
                })
            )
        );
    });

    it('renders ShareCandlestickChart with the bars and ticker when chartBars is provided', async () => {
        render(
            <ChartSharePanel
                result={{} as never}
                chartBars={STUB_BARS}
                symbol="TSLA"
            />
        );
        await waitFor(() =>
            expect(mockShareCandlestickChart).toHaveBeenCalledWith(
                expect.objectContaining({ bars: STUB_BARS, ticker: 'TSLA' })
            )
        );
    });

    it('does not render ShareCandlestickChart when chartBars is absent', async () => {
        render(<ChartSharePanel result={{} as never} />);
        await waitFor(() => expect(mockAnalysisPanel).toHaveBeenCalled());
        expect(mockShareCandlestickChart).not.toHaveBeenCalled();
    });

    it('does not render ShareCandlestickChart when chartBars is empty', async () => {
        render(<ChartSharePanel result={{} as never} chartBars={[]} />);
        await waitFor(() => expect(mockAnalysisPanel).toHaveBeenCalled());
        expect(mockShareCandlestickChart).not.toHaveBeenCalled();
    });
});
