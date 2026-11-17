import { act, render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ChartOverlay } from '@y0ngha/siglens-core';
import ko from '../../../../messages/ko.json';
import type {
    ChatChartBlock,
    ChatChartTimeframe,
} from '@/entities/chat-conversation/types';
import { ChatChart } from '@/widgets/chart/ChatChart';

const { renderStockChart } = vi.hoisted(() => ({
    renderStockChart: vi.fn(),
}));

// `StockChart`는 lightweight-charts 캔버스라 jsdom에서 돌지 않는다 — 넘긴 props만 본다.
vi.mock('@/widgets/chart/StockChart', () => ({
    StockChart: (props: Record<string, unknown>) => {
        renderStockChart(props);
        return <div data-testid="stock-chart" />;
    },
}));

/** 가장 최근 렌더에서 `StockChart`가 받은 props. */
const latestProps = (): Record<string, unknown> =>
    (renderStockChart.mock.lastCall?.[0] as Record<string, unknown>) ?? {};

const DAY = 86_400;
const pattern = {
    id: 'o1',
    kind: 'pattern',
    skill: 'double-bottom',
    sourceRef: 'p1',
    variant: 'primary',
    segments: [
        {
            from: { time: 0, price: 1 },
            to: { time: DAY, price: 2 },
            role: 'neckline',
            style: 'solid',
            pane: 'price',
        },
    ],
    levels: [],
    labels: [],
} as unknown as ChartOverlay;

const block = (timeframe: ChatChartTimeframe): ChatChartBlock => ({
    version: 1,
    symbol: 'QQQ',
    timeframe,
    marketProfile: 'us-equity',
    bars: [0, DAY, 2 * DAY].map(time => ({
        time,
        open: 1,
        high: 2,
        low: 1,
        close: 2,
        volume: 1,
    })),
    overlays: [pattern],
    overlayColors: { p1: '#123456' },
    overlayLabels: { p1: 'Abandoned Baby / Tri-Star Guide' },
    analyzedAt: null,
});

const renderChart = (timeframe: ChatChartTimeframe = '1Day') =>
    render(
        <NextIntlClientProvider locale="ko" messages={ko}>
            <ChatChart block={block(timeframe)} />
        </NextIntlClientProvider>
    );

describe('ChatChart', () => {
    beforeEach(() => renderStockChart.mockClear());

    it('블록의 봉·작도·색과 작도 켜고 끄기 항목을 StockChart에 넘긴다', () => {
        renderChart();
        expect(latestProps()).toMatchObject({
            ticker: 'QQQ',
            timeframe: '1Day',
            marketProfile: 'us-equity',
            chartOverlays: [pattern],
            overlayColors: { p1: '#123456' },
        });
        expect(latestProps().overlayItems).toEqual([
            expect.objectContaining({ key: 'p1', kind: 'pattern' }),
        ]);
    });

    it('작도 항목 이름은 스킬 원래 이름을 로케일 표시명으로 바꾼다', () => {
        renderChart();
        expect(latestProps().overlayItems).toEqual([
            expect.objectContaining({
                key: 'p1',
                label: '어밴던드 베이비 / 트라이스타형',
            }),
        ]);
    });

    it('작도는 모두 켜진 채로 시작한다', () => {
        renderChart();
        expect(latestProps().hiddenOverlayKeys).toEqual(new Set());
    });

    it('보조지표 메뉴는 그리지 않는다(지표 데이터를 넘기지 않는다)', () => {
        renderChart();
        expect(latestProps().showIndicatorMenu).toBe(false);
    });

    it('레벨 제목 여백을 차트 시간축 오른쪽 여백으로 적용한다(차트가 준비되기 전에 와도)', () => {
        renderChart();
        const applyOptions = vi.fn();
        const props = latestProps() as {
            onRightGutterChange: (px: number) => void;
            onChartReady: (chart: unknown) => void;
        };
        act(() => props.onRightGutterChange(48));
        act(() => props.onChartReady({ applyOptions }));
        expect(applyOptions).toHaveBeenLastCalledWith({
            timeScale: { rightOffsetPixels: 48 },
        });
        act(() => props.onRightGutterChange(64));
        expect(applyOptions).toHaveBeenLastCalledWith({
            timeScale: { rightOffsetPixels: 64 },
        });
    });

    it('주봉·월봉은 일봉 시간축 서식으로 그린다', () => {
        renderChart('1Week');
        expect(latestProps().timeframe).toBe('1Day');
    });

    it('작도를 끄고 다시 켤 수 있다', () => {
        renderChart();
        const setVisible = latestProps().onSetOverlayVisible as (
            keys: readonly string[],
            visible: boolean
        ) => void;
        act(() => setVisible(['p1'], false));
        expect(
            (latestProps().hiddenOverlayKeys as ReadonlySet<string>).has('p1')
        ).toBe(true);
        act(() => setVisible(['p1'], true));
        expect(
            (latestProps().hiddenOverlayKeys as ReadonlySet<string>).size
        ).toBe(0);
    });
});
