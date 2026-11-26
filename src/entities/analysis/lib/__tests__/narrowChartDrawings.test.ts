import { narrowChartDrawings } from '@/entities/analysis/lib/narrowChartDrawings';

const DAY = 86_400;
const T0 = 1_790_000_000;

/**
 * 저장 형태(`analysis_history.result`의 jsonb)와 같은 모양의 작도 — 이중바닥 패턴 + 추세선.
 *
 * 실제 저장 행에서 떠 온 값이 아니라 core `ChartOverlay` 타입을 따라 손으로 만든 픽스처다. 작도 후보 생성기
 * (`buildOverlayCandidates`)는 core 내부라 밖에서 부를 수 없고, 이 작업에는 로컬 `analysis_history` 실행 행이 없었다
 * (운영 DB는 읽지 않는다). 로컬에서 실제 분석을 돌려 남은 행의 `result.chartOverlays`로 바꿀 수 있다.
 */
const PATTERN_OVERLAY = {
    id: 'pattern:double_bottom:1790000000',
    kind: 'pattern',
    skill: 'double_bottom',
    sourceRef: 'double-bottom-1',
    variant: 'primary',
    segments: [
        {
            from: { time: T0, price: 100 },
            to: { time: T0 + 10 * DAY, price: 90 },
            role: 'pattern',
            style: 'solid',
            pane: 'price',
        },
    ],
    levels: [{ price: 110, fromTime: T0 + 5 * DAY, label: 'breakout' }],
    labels: [
        {
            at: { time: T0 + 10 * DAY, price: 90 },
            text: 'H',
            position: 'below',
        },
    ],
};

const TRENDLINE_OVERLAY = {
    id: 'tl:up:1',
    kind: 'trendline',
    skill: 'trendline',
    sourceRef: 'trendlines',
    variant: 'primary',
    segments: [
        {
            from: { time: T0, price: 95 },
            to: { time: T0 + 20 * DAY, price: 105 },
            role: 'support',
            style: 'dashed',
            pane: 'price',
        },
    ],
    levels: [],
    labels: [],
};

const RESULT = {
    summary: '요약',
    chartOverlays: [PATTERN_OVERLAY, TRENDLINE_OVERLAY],
    patternSummaries: [
        {
            id: 'double-bottom-1',
            skillName: '이중바닥',
            renderConfig: { color: '#22c55e' },
        },
        { id: 'plain', skillName: '삼각수렴' },
    ],
    strategyResults: [{ id: 'fib-1', strategyName: '피보나치' }],
    analyzedAt: '2026-11-25T00:00:00.000Z',
};

describe('narrowChartDrawings', () => {
    it('저장 형태의 작도·색·카드 이름을 그대로 좁힌다', () => {
        expect(narrowChartDrawings(RESULT)).toEqual({
            overlays: [PATTERN_OVERLAY, TRENDLINE_OVERLAY],
            overlayColors: { 'double-bottom-1': '#22c55e' },
            overlayLabels: {
                'double-bottom-1': '이중바닥',
                plain: '삼각수렴',
                'fib-1': '피보나치',
            },
        });
    });

    it('깨진 작도만 버리고 나머지는 남긴다', () => {
        const broken = {
            ...TRENDLINE_OVERLAY,
            id: 'tl:bad',
            segments: [
                {
                    ...TRENDLINE_OVERLAY.segments[0],
                    to: { time: 'x', price: 1 },
                },
            ],
        };
        const result = narrowChartDrawings({
            ...RESULT,
            chartOverlays: [PATTERN_OVERLAY, broken],
        });
        expect(result?.overlays.map(o => o.id)).toEqual([PATTERN_OVERLAY.id]);
    });

    it.each([
        ['모르는 kind', { ...PATTERN_OVERLAY, kind: 'harmonic' }],
        ['프로토타입 kind', { ...PATTERN_OVERLAY, kind: 'constructor' }],
        ['모르는 variant', { ...PATTERN_OVERLAY, variant: 'third' }],
        [
            '모르는 style',
            {
                ...PATTERN_OVERLAY,
                segments: [{ ...PATTERN_OVERLAY.segments[0], style: 'dotted' }],
            },
        ],
        [
            '모르는 pane',
            {
                ...PATTERN_OVERLAY,
                segments: [{ ...PATTERN_OVERLAY.segments[0], pane: 'macd' }],
            },
        ],
        [
            '유한하지 않은 가격',
            {
                ...PATTERN_OVERLAY,
                levels: [{ price: null, fromTime: T0, label: 'breakout' }],
            },
        ],
        [
            '모르는 라벨 위치',
            {
                ...PATTERN_OVERLAY,
                labels: [{ ...PATTERN_OVERLAY.labels[0], position: 'left' }],
            },
        ],
    ])('%s인 작도는 버린다', (_name, overlay) => {
        expect(
            narrowChartDrawings({ ...RESULT, chartOverlays: [overlay] })
        ).toBeNull();
    });

    it('작도가 없거나 형태가 다르면 null', () => {
        expect(narrowChartDrawings(null)).toBeNull();
        expect(narrowChartDrawings([])).toBeNull();
        expect(narrowChartDrawings({ summary: 'x' })).toBeNull();
        expect(narrowChartDrawings({ chartOverlays: [] })).toBeNull();
        expect(narrowChartDrawings({ chartOverlays: 'x' })).toBeNull();
    });

    it('색·이름 목록이 없거나 깨져도 작도는 남는다', () => {
        expect(
            narrowChartDrawings({
                chartOverlays: [PATTERN_OVERLAY],
                patternSummaries: 'x',
                strategyResults: [{ id: 3 }],
            })
        ).toEqual({
            overlays: [PATTERN_OVERLAY],
            overlayColors: {},
            overlayLabels: {},
        });
    });
});
