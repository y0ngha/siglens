import type { Bar, ChartOverlay } from '@y0ngha/siglens-core';
import { defined } from '@/shared/test-utils/defined';
import { OG_BG } from '@/shared/lib/og';
import {
    layoutReportChart,
    REPORT_CHART_HEADER_HEIGHT,
} from '@/entities/email-report/lib/reportChartLayout';
import { buildReportChartImage } from '@/entities/email-report/server/buildReportChartImage';
import { decodePng } from './support/decodePng';

const DAY = 86_400;
const T0 = 1_790_000_000;

/** 시가=종가=100, 고가 110, 저가 90인 봉 — 수평 레벨 100이 캔들 몸통과 같은 높이다. */
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

const hex = (value: string): [number, number, number] => [
    Number.parseInt(value.slice(1, 3), 16),
    Number.parseInt(value.slice(3, 5), 16),
    Number.parseInt(value.slice(5, 7), 16),
];

function close(
    actual: readonly number[],
    expected: readonly number[],
    tolerance = 3
): boolean {
    return expected.every(
        (e, i) => Math.abs((actual[i] ?? -999) - e) <= tolerance
    );
}

const LEVEL: ChartOverlay = {
    id: 'p',
    kind: 'pattern',
    skill: 'x',
    sourceRef: 'p1',
    variant: 'primary',
    segments: [],
    levels: [{ price: 100, fromTime: T0 + 70 * DAY, label: 'breakout' }],
    labels: [],
};

const LEVEL_COLOR = '#e11d48';

async function renderPng(withDrawings: boolean) {
    const image = defined(
        buildReportChartImage({
            symbol: 'AAPL',
            date: '2026-10-08',
            bars: bars(100),
            ma: {},
            drawings: withDrawings
                ? {
                      overlays: [LEVEL],
                      overlayColors: { p1: LEVEL_COLOR },
                      overlayLabels: {},
                  }
                : null,
            cacheControl: 'no-store',
        })
    );
    const bytes = new Uint8Array(await image.arrayBuffer());
    return { bytes, png: decodePng(bytes) };
}

describe('buildReportChartImage — 실제 PNG 한 점 확인', () => {
    it('수평 레벨 행의 알려진 x에 레벨 색이 있고 점선 틈에는 없다', async () => {
        const layout = defined(
            layoutReportChart(
                bars(100),
                {},
                {
                    overlays: [LEVEL],
                    overlayColors: { p1: LEVEL_COLOR },
                    overlayLabels: {},
                }
            )
        );
        const { png } = await renderPng(true);
        // 레벨 시작 봉(인덱스 70)은 창(마지막 60봉, 인덱스 40..99)에서 30번째.
        const startX = layout.geo.xAt(30);
        const row = Math.round(
            REPORT_CHART_HEADER_HEIGHT + layout.geo.yAt(100)
        );

        // 점선은 12px 그리고 8px 쉰다 — 시작 직후(+6)는 선, 13~19px 뒤(+16)는 틈이라 레벨 색이 아니다
        // (그 자리에는 캔들 몸통이 보인다).
        expect(
            close(png.pixel(Math.round(startX) + 6, row), hex(LEVEL_COLOR))
        ).toBe(true);
        expect(
            close(png.pixel(Math.round(startX) + 16, row), hex(LEVEL_COLOR))
        ).toBe(false);
        // 선 두께 3px: 위아래 이웃 행은 선 색이 섞이거나 배경이다.
        expect(
            close(png.pixel(Math.round(startX) + 6, row - 4), hex(LEVEL_COLOR))
        ).toBe(false);
    });

    it('작도가 있으면 오른쪽 여백에 캔들 대신 가격표 글자가 레벨 행 높이에만 찍힌다', async () => {
        const layout = defined(
            layoutReportChart(
                bars(100),
                {},
                {
                    overlays: [LEVEL],
                    overlayColors: { p1: LEVEL_COLOR },
                    overlayLabels: {},
                }
            )
        );
        const { png } = await renderPng(true);
        const tagTop =
            Math.round(REPORT_CHART_HEADER_HEIGHT + layout.geo.yAt(100)) - 16;
        const farTop = tagTop - 120;
        const countInk = (top: number) => {
            let ink = 0;
            for (let y = top; y < top + 32; y++)
                for (let x = layout.plotWidth + 10; x < 1190; x++)
                    if (!close(png.pixel(x, y), hex(OG_BG), 12)) ink++;
            return ink;
        };

        expect(countInk(tagTop)).toBeGreaterThan(40);
        expect(countInk(farTop)).toBe(0);
    });

    it('작도가 없으면 같은 행에 레벨 색이 없다', async () => {
        const layout = defined(layoutReportChart(bars(100), {}, null));
        const { png } = await renderPng(false);
        const row = Math.round(
            REPORT_CHART_HEADER_HEIGHT + layout.geo.yAt(100)
        );

        for (let x = 700; x < 760; x++)
            expect(close(png.pixel(x, row), hex(LEVEL_COLOR))).toBe(false);
    });

    it('작도 이미지는 PNG이고 작도 없는 이미지보다 크다', async () => {
        const withDrawings = await renderPng(true);
        const without = await renderPng(false);

        expect(Array.from(withDrawings.bytes.subarray(1, 4))).toEqual([
            0x50, 0x4e, 0x47,
        ]);
        expect(withDrawings.png.width).toBe(1200);
        expect(withDrawings.png.height).toBe(600);
        expect(withDrawings.bytes.length).toBeGreaterThan(without.bytes.length);
    });
}, 60_000);
