import type { Bar, ChartOverlay } from '@y0ngha/siglens-core';
import { REPORT_CHART_BARS } from '@/entities/email-report/lib/chartGeometry';
import {
    layoutReportChart,
    REPORT_CHART_GUTTER_WIDTH,
    REPORT_CHART_WIDTH,
} from '@/entities/email-report/lib/reportChartLayout';
import { defined } from '@/shared/test-utils/defined';

const DAY = 86_400;
const T0 = 1_790_000_000;

function bars(count: number): Bar[] {
    return Array.from({ length: count }, (_, i) => ({
        time: T0 + i * DAY,
        open: 100,
        high: 110,
        low: 90,
        close: 100,
        volume: 1,
    }));
}

function trend(fromIndex: number, toIndex: number, price = 95): ChartOverlay {
    return {
        id: `t-${fromIndex}`,
        kind: 'trendline',
        skill: 'trendline',
        sourceRef: 'trendlines',
        variant: 'primary',
        segments: [
            {
                from: { time: T0 + fromIndex * DAY, price },
                to: { time: T0 + toIndex * DAY, price: price + 5 },
                role: 'support',
                style: 'solid',
                pane: 'price',
            },
        ],
        levels: [],
        labels: [],
    };
}

const drawings = (overlays: ChartOverlay[]) => ({
    overlays,
    overlayColors: {},
    overlayLabels: {},
});

describe('layoutReportChart', () => {
    it('작도가 없으면 예전 이미지와 같은 배치(전체 폭, 60봉, 작도 없음)', () => {
        const layout = defined(layoutReportChart(bars(100), {}, null));

        expect(layout.plotWidth).toBe(REPORT_CHART_WIDTH);
        expect(layout.drawn).toBeNull();
        expect(layout.geo.count).toBe(REPORT_CHART_BARS);
    });

    it('작도가 그려지면 오른쪽 여백만큼 plot 폭을 줄이고, 이른 작도에 맞춰 창을 넓힌다', () => {
        const layout = defined(
            layoutReportChart(bars(200), {}, drawings([trend(120, 190)]))
        );

        expect(layout.plotWidth).toBe(
            REPORT_CHART_WIDTH - REPORT_CHART_GUTTER_WIDTH
        );
        expect(layout.drawn?.lines).toHaveLength(1);
        expect(layout.geo.count).toBe(80);
    });

    it('작도가 모두 창 밖이면 작도 없는 배치로 돌아간다', () => {
        const layout = defined(
            layoutReportChart(bars(300), {}, drawings([trend(10, 50)]))
        );

        expect(layout.drawn).toBeNull();
        expect(layout.plotWidth).toBe(REPORT_CHART_WIDTH);
        expect(layout.geo.count).toBe(REPORT_CHART_BARS);
    });

    it('작도가 있어도 그릴 선이 하나도 없으면(가격이 축 밖) 작도 없는 배치다', () => {
        const layout = defined(
            layoutReportChart(bars(100), {}, drawings([trend(60, 90, 200)]))
        );

        expect(layout.drawn).toBeNull();
        expect(layout.plotWidth).toBe(REPORT_CHART_WIDTH);
    });

    it('봉이 없으면 null', () => {
        expect(layoutReportChart([], {}, drawings([]))).toBeNull();
    });
});
