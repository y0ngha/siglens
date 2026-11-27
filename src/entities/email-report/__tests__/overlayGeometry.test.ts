import type { Bar, ChartOverlay, OverlaySegment } from '@y0ngha/siglens-core';
import { defined } from '@/shared/test-utils/defined';
import {
    patternPaletteByKey,
    buildOverlayMenuItems,
} from '@/entities/analysis/lib/chartOverlays/overlayItems';
import { barTimesOf } from '@/entities/analysis/lib/overlayAlignment';
import { CHART_COLORS } from '@/shared/lib/chartColors';
import { computeChartGeometry } from '@/entities/email-report/lib/chartGeometry';
import {
    computeOverlayGeometry,
    formatLevelPrice,
    planDrawingWindow,
    toLegendEntries,
} from '@/entities/email-report/lib/overlayGeometry';

const DAY = 86_400;
const T0 = 1_790_000_000;
const PLOT_WIDTH = 1050;
const BOX = { width: PLOT_WIDTH, height: 480, padding: 24 };

/** 모든 봉이 시가=종가=100, 고가 110, 저가 90 — 가격축이 정확히 [90, 110]이다. */
function flatBars(count: number): Bar[] {
    return Array.from({ length: count }, (_, i) => ({
        time: T0 + i * DAY,
        open: 100,
        high: 110,
        low: 90,
        close: 100,
        volume: 1,
    }));
}
const timeAt = (i: number) => T0 + i * DAY;

function segment(
    fromIndex: number,
    fromPrice: number,
    toIndex: number,
    toPrice: number,
    overrides: Partial<OverlaySegment> = {}
): OverlaySegment {
    return {
        from: { time: timeAt(fromIndex), price: fromPrice },
        to: { time: timeAt(toIndex), price: toPrice },
        role: 'support',
        style: 'solid',
        pane: 'price',
        ...overrides,
    };
}

function overlay(overrides: Partial<ChartOverlay>): ChartOverlay {
    return {
        id: 'o1',
        kind: 'trendline',
        skill: 'trendline',
        sourceRef: 'trendlines',
        variant: 'primary',
        segments: [],
        levels: [],
        labels: [],
        ...overrides,
    };
}

const NO_COLORS = { overlayColors: {}, overlayLabels: {} };

/** 100봉 중 마지막 `windowSize`봉 창으로 작도를 계산한다. */
function compute(
    overlays: ChartOverlay[],
    options: {
        bars?: Bar[];
        windowSize?: number;
        drawings?: typeof NO_COLORS;
    } = {}
) {
    const bars = options.bars ?? flatBars(100);
    const geo = defined(
        computeChartGeometry(bars, {}, BOX, options.windowSize ?? 60)
    );
    const plan = planDrawingWindow(bars, overlays);
    return {
        geo,
        bars,
        result: computeOverlayGeometry({
            bars,
            geo,
            plotWidth: PLOT_WIDTH,
            overlays: plan.overlays,
            drawings: options.drawings ?? NO_COLORS,
        }),
    };
}

describe('planDrawingWindow', () => {
    const bars = flatBars(200);
    const trend = (fromBack: number) =>
        overlay({
            id: `t${fromBack}`,
            segments: [segment(200 - fromBack, 95, 199, 105)],
        });

    it('작도가 최근 60봉 안이면 창은 60봉 그대로', () => {
        expect(planDrawingWindow(bars, [trend(30)]).windowSize).toBe(60);
    });

    it('더 이른 작도가 있으면 그 시각까지 창을 넓힌다', () => {
        const plan = planDrawingWindow(bars, [trend(30), trend(90)]);
        expect(plan.windowSize).toBe(90);
        expect(plan.overlays).toHaveLength(2);
    });

    it('창은 120봉이 상한이고, 상한 밖에서 시작하는 작도는 자르지 않고 뺀다', () => {
        const plan = planDrawingWindow(bars, [trend(30), trend(150)]);
        expect(plan.windowSize).toBe(60);
        expect(plan.overlays.map(o => o.id)).toEqual(['t30']);

        const edge = planDrawingWindow(bars, [trend(120)]);
        expect(edge.windowSize).toBe(120);
        expect(edge.overlays).toHaveLength(1);
    });

    it('상한 밖 작도 하나만 있으면 작도 없음(빈 목록)', () => {
        expect(planDrawingWindow(bars, [trend(150)]).overlays).toEqual([]);
    });

    it('봉 시각에 맞지 않는 작도는 뺀다', () => {
        const shifted = overlay({
            segments: [
                {
                    ...segment(150, 95, 190, 105),
                    to: { time: timeAt(190) + 1, price: 105 },
                },
            ],
        });
        expect(planDrawingWindow(bars, [shifted]).overlays).toEqual([]);
    });
});

describe('computeOverlayGeometry — 선', () => {
    it('선분 두 끝을 캔들 중심 x와 같은 가격축 y로 옮긴다', () => {
        const { geo, result } = compute([
            overlay({ segments: [segment(50, 95, 90, 105)] }),
        ]);

        // 창은 마지막 60봉(인덱스 40..99) → 봉 50은 보이는 인덱스 10.
        expect(result.lines).toEqual([
            {
                x1: geo.xAt(10),
                y1: geo.yAt(95),
                x2: geo.xAt(50),
                y2: geo.yAt(105),
                color: CHART_COLORS.bullish,
                dashed: false,
                opacity: 1,
            },
        ]);
        expect(geo.yAt(110)).toBe(24);
        expect(geo.yAt(90)).toBe(456);
    });

    it('수평 레벨은 시작 봉에서 plot 오른쪽 끝까지 점선으로 간다', () => {
        const { geo, result } = compute([
            overlay({
                kind: 'pattern',
                sourceRef: 'p1',
                levels: [
                    { price: 100, fromTime: timeAt(70), label: 'breakout' },
                ],
            }),
        ]);

        expect(result.lines).toHaveLength(1);
        expect(result.lines[0]).toMatchObject({
            x1: geo.xAt(30),
            x2: PLOT_WIDTH,
            y1: geo.yAt(100),
            y2: geo.yAt(100),
            dashed: true,
        });
    });

    it('RSI 패인 선분은 그리지 않는다(다이버전스의 가격 선분만 남는다)', () => {
        const { result } = compute([
            overlay({
                kind: 'divergence',
                sourceRef: 'kind:divergence',
                segments: [
                    segment(60, 95, 80, 105, { role: 'price' }),
                    // RSI 값(0~100)이 우연히 가격축 안에 들어와도 그리지 않아야 한다.
                    segment(60, 92, 80, 108, { role: 'rsi', pane: 'rsi' }),
                ],
            }),
        ]);

        expect(result.lines).toHaveLength(1);
    });

    it('대안(alternate) 작도는 반투명이다', () => {
        const { result } = compute([
            overlay({
                kind: 'elliott',
                sourceRef: 'kind:elliott',
                variant: 'alternate',
                segments: [segment(60, 95, 80, 105, { role: 'wave_1' })],
            }),
        ]);

        expect(result.lines[0]?.opacity).toBe(0.5);
    });

    it('축 밖 수평 레벨은 선도 가격표도 그리지 않는다', () => {
        const { result } = compute([
            overlay({
                kind: 'fibonacci',
                sourceRef: 'kind:fibonacci',
                levels: [
                    { price: 100, fromTime: timeAt(70), label: '61.8%' },
                    { price: 130, fromTime: timeAt(70), label: '161.8%' },
                    { price: 80, fromTime: timeAt(70), label: '0%' },
                ],
            }),
        ]);

        expect(result.lines).toHaveLength(1);
        expect(result.tags.map(tag => tag.text)).toEqual(['61.8%']);
    });

    it('선분은 한쪽 끝이 축 밖이어도 축을 지나면 그리고, 통째로 같은 쪽 밖이면 뺀다', () => {
        const { result } = compute([
            overlay({
                id: 'crossing',
                segments: [segment(60, 80, 90, 105)],
            }),
            overlay({
                id: 'above',
                segments: [segment(60, 120, 90, 140)],
            }),
            overlay({
                id: 'below',
                segments: [segment(60, 70, 90, 80)],
            }),
            overlay({
                id: 'through',
                segments: [segment(60, 80, 90, 120)],
            }),
        ]);

        expect(result.lines).toHaveLength(2);
    });

    it('도달한 목표 레벨은 반투명이고 도달하지 않은 레벨은 불투명이다', () => {
        // 상승 다리의 확장 레벨: 마지막 종가(100)가 95를 넘어서 있으면 도달, 105는 아직.
        const { result } = compute([
            overlay({
                kind: 'fibonacci',
                sourceRef: 'kind:fibonacci',
                segments: [segment(60, 90, 80, 110, { role: 'leg' })],
                levels: [
                    { price: 95, fromTime: timeAt(80), label: 'ext 127.2%' },
                    { price: 105, fromTime: timeAt(80), label: 'ext 161.8%' },
                ],
            }),
        ]);

        const levelLines = result.lines.filter(l => l.dashed);
        expect(levelLines.map(l => l.opacity).sort()).toEqual([0.5, 1]);
    });
});

describe('computeOverlayGeometry — 가격표와 점 라벨', () => {
    it('피보나치는 비율, 나머지는 가격으로 쓰고 선과 같은 색·높이에 둔다', () => {
        const { geo, result } = compute([
            overlay({
                kind: 'fibonacci',
                sourceRef: 'kind:fibonacci',
                levels: [{ price: 104, fromTime: timeAt(70), label: '61.8%' }],
            }),
            overlay({
                id: 'p',
                kind: 'pattern',
                sourceRef: 'p1',
                levels: [
                    { price: 96, fromTime: timeAt(70), label: 'breakout' },
                ],
            }),
        ]);

        expect(result.tags).toEqual([
            {
                y: geo.yAt(104),
                text: '61.8%',
                color: CHART_COLORS.bollingerUpper,
                opacity: 1,
            },
            {
                y: geo.yAt(96),
                text: '96.00',
                color: CHART_COLORS.neutral,
                opacity: 1,
            },
        ]);
    });

    it('가까운 가격표는 우선순위가 높은 쪽만 남고, 선은 둘 다 남는다', () => {
        // 100과 100.5는 y로 약 11px 차이 — 최소 간격 30px 안.
        const levels = [
            { price: 100.5, fromTime: timeAt(70), label: 'target' },
            { price: 100, fromTime: timeAt(70), label: 'breakout' },
        ];
        const { result } = compute([
            overlay({ kind: 'pattern', sourceRef: 'p1', levels }),
        ]);

        expect(result.lines).toHaveLength(2);
        expect(result.tags.map(t => t.text)).toEqual(['100.00']);
    });

    it('우선순위가 같으면 앞선 것이 남는다(입력 순서로 결정)', () => {
        const { result } = compute([
            overlay({
                kind: 'pattern',
                sourceRef: 'p1',
                levels: [
                    { price: 101, fromTime: timeAt(70), label: 'target' },
                    { price: 100, fromTime: timeAt(70), label: 'invalidation' },
                ],
            }),
        ]);

        expect(result.tags.map(t => t.text)).toEqual(['101.00']);
    });

    it('점 라벨(파동 번호 등)은 봉 중심 x·가격 y에 위치만 싣는다', () => {
        const { geo, result } = compute([
            overlay({
                kind: 'elliott',
                sourceRef: 'kind:elliott',
                segments: [segment(60, 95, 80, 105, { role: 'wave_1' })],
                labels: [
                    {
                        at: { time: timeAt(80), price: 105 },
                        text: '1',
                        position: 'above',
                    },
                    {
                        at: { time: timeAt(60), price: 95 },
                        text: '2',
                        position: 'below',
                    },
                    {
                        at: { time: timeAt(70), price: 150 },
                        text: '3',
                        position: 'above',
                    },
                ],
            }),
        ]);

        expect(result.pointLabels).toEqual([
            {
                x: geo.xAt(40),
                y: geo.yAt(105),
                text: '1',
                position: 'above',
                color: CHART_COLORS.stochasticK,
            },
            {
                x: geo.xAt(20),
                y: geo.yAt(95),
                text: '2',
                position: 'below',
                color: CHART_COLORS.stochasticK,
            },
        ]);
    });
});

describe('computeOverlayGeometry — 색', () => {
    const pattern = (id: string, ref: string): ChartOverlay =>
        overlay({
            id,
            kind: 'pattern',
            sourceRef: ref,
            segments: [segment(60, 95, 80, 105, { role: 'pattern' })],
        });

    it('패턴이 하나면 스킬 색, 없으면 중립 폴백', () => {
        const colored = compute([pattern('a', 'p1')], {
            drawings: { overlayColors: { p1: '#123456' }, overlayLabels: {} },
        });
        expect(colored.result.lines[0]?.color).toBe('#123456');

        const fallback = compute([pattern('a', 'p1')]);
        expect(fallback.result.lines[0]?.color).toBe(CHART_COLORS.neutral);
    });

    it('패턴이 둘 이상이면 사이트와 같은 팔레트 순서(항목 순서대로)다', () => {
        const overlays = [pattern('a', 'p1'), pattern('b', 'p2')];
        const drawings = {
            overlayColors: { p1: '#111111', p2: '#222222' },
            overlayLabels: { p1: '이중바닥', p2: '삼각수렴' },
        };
        const { bars, result } = compute(overlays, { drawings });

        const times = barTimesOf(bars.slice(-60));
        const items = buildOverlayMenuItems(overlays, {
            barTimes: times,
            lastBarTime: defined(bars.at(-1)).time,
            labelFor: ref => drawings.overlayLabels[ref as 'p1' | 'p2'],
            hasActionPrices: false,
        });
        const palette = patternPaletteByKey(items, [
            CHART_COLORS.overlayPattern1,
            CHART_COLORS.overlayPattern2,
            CHART_COLORS.overlayPattern3,
            CHART_COLORS.overlayPattern4,
            CHART_COLORS.overlayPattern5,
            CHART_COLORS.overlayPattern6,
        ]);
        expect(result.lines.map(l => l.color)).toEqual([
            palette.get('p1'),
            palette.get('p2'),
        ]);
        expect(result.lines.map(l => l.color)).toEqual([
            CHART_COLORS.overlayPattern1,
            CHART_COLORS.overlayPattern2,
        ]);
    });

    it('추세선은 역할로(support 상승색, resistance 하락색), 나머지는 종류 고정색', () => {
        const { result } = compute([
            overlay({
                id: 's',
                segments: [segment(60, 95, 80, 105, { role: 'support' })],
            }),
            overlay({
                id: 'r',
                segments: [segment(60, 105, 80, 95, { role: 'resistance' })],
            }),
            overlay({
                id: 'd',
                kind: 'divergence',
                sourceRef: 'kind:divergence',
                segments: [segment(60, 95, 80, 105, { role: 'price' })],
            }),
        ]);

        expect(result.lines.map(l => l.color)).toEqual([
            CHART_COLORS.bullish,
            CHART_COLORS.bearish,
            CHART_COLORS.macdSignal,
        ]);
    });
});

describe('computeOverlayGeometry — 범례 원료', () => {
    it('선이 하나라도 그려진 항목만 남는다(축 밖뿐인 작도는 빠진다)', () => {
        const { result } = compute([
            overlay({
                id: 'drawn',
                kind: 'pattern',
                sourceRef: 'p1',
                segments: [segment(60, 95, 80, 105, { role: 'pattern' })],
            }),
            overlay({
                id: 'off',
                kind: 'pattern',
                sourceRef: 'p2',
                levels: [{ price: 200, fromTime: timeAt(70), label: 'target' }],
            }),
        ]);

        expect(result.drawnItems.map(d => d.item.key)).toEqual(['p1']);
    });

    it('선이 하나도 없으면 빈 결과', () => {
        const { result } = compute([]);
        expect(result).toEqual({
            lines: [],
            tags: [],
            pointLabels: [],
            drawnItems: [],
        });
    });
});

describe('toLegendEntries', () => {
    const drawn = (item: object, color = '#fff') => ({
        item: item as never,
        color,
    });

    it('추세선은 방향별, 종류 항목은 종류별로 한 칸이고 카드는 이름을 싣는다', () => {
        expect(
            toLegendEntries(
                [
                    drawn(
                        { key: 'p1', kind: 'pattern', label: '이중바닥' },
                        '#1'
                    ),
                    drawn(
                        {
                            key: 't1',
                            kind: 'trendline',
                            direction: 'up',
                            index: 1,
                        },
                        '#2'
                    ),
                    drawn(
                        {
                            key: 't2',
                            kind: 'trendline',
                            direction: 'up',
                            index: 2,
                        },
                        '#3'
                    ),
                    drawn(
                        {
                            key: 't3',
                            kind: 'trendline',
                            direction: 'down',
                            index: 1,
                        },
                        '#4'
                    ),
                    drawn(
                        {
                            key: 'kind:fibonacci',
                            kind: 'fibonacci',
                            label: null,
                        },
                        '#5'
                    ),
                    drawn({ key: 'ui:action-prices', kind: 'action' }),
                ],
                { p1: '이중바닥' }
            )
        ).toEqual([
            { kind: 'card', name: '이중바닥', color: '#1' },
            { kind: 'trendUp', color: '#2' },
            { kind: 'trendDown', color: '#4' },
            { kind: 'fibonacci', color: '#5' },
        ]);
    });

    it('이름을 모르는 카드는 칸을 만들지 않는다(내부 id 노출 방지)', () => {
        expect(
            toLegendEntries(
                [
                    drawn({
                        key: 'secret-id',
                        kind: 'pattern',
                        label: 'secret-id',
                    }),
                ],
                {}
            )
        ).toEqual([]);
    });
});

describe('formatLevelPrice', () => {
    it.each([
        [71_500, '71,500'],
        [182.456, '182.46'],
        [5, '5.00'],
        [0.0006, '0.0006000'],
    ])('%s → %s', (value, expected) => {
        expect(formatLevelPrice(value)).toBe(expected);
    });
});
