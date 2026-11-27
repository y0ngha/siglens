const rendered = vi.hoisted(() => ({ element: null as unknown }));

vi.mock('next/og', () => ({
    ImageResponse: class {
        headers = new Headers();
        constructor(element: unknown) {
            rendered.element = element;
        }
    },
}));

import type { Bar } from '@y0ngha/siglens-core';
import type { ChartDrawingSource } from '@/entities/analysis/lib/narrowChartDrawings';
import type { ReactElement, ReactNode } from 'react';

import { buildReportChartImage } from '@/entities/email-report/server/buildReportChartImage';
import {
    REPORT_CHART_GUTTER_WIDTH,
    REPORT_CHART_WIDTH,
} from '@/entities/email-report/lib/reportChartLayout';

const DAY = 86_400;
const T0 = 1_790_000_000;
const PLOT_WIDTH = REPORT_CHART_WIDTH - REPORT_CHART_GUTTER_WIDTH;

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

const DRAWINGS: ChartDrawingSource = {
    overlays: [
        {
            id: 'tl',
            kind: 'trendline',
            skill: 'trendline',
            sourceRef: 'trendlines',
            variant: 'primary',
            segments: [
                {
                    from: { time: T0 + 60 * DAY, price: 95 },
                    to: { time: T0 + 90 * DAY, price: 105 },
                    role: 'support',
                    style: 'solid',
                    pane: 'price',
                },
            ],
            levels: [],
            labels: [],
        },
        {
            id: 'wave',
            kind: 'elliott',
            skill: 'elliott',
            sourceRef: 'kind:elliott',
            variant: 'primary',
            segments: [
                {
                    from: { time: T0 + 60 * DAY, price: 92 },
                    to: { time: T0 + 80 * DAY, price: 108 },
                    role: 'wave_1',
                    style: 'dashed',
                    pane: 'price',
                },
            ],
            levels: [{ price: 100, fromTime: T0 + 80 * DAY, label: 'target' }],
            labels: [
                {
                    at: { time: T0 + 80 * DAY, price: 108 },
                    text: '1',
                    position: 'above',
                },
            ],
        },
    ],
    overlayColors: {},
    overlayLabels: {},
};

interface Node {
    type: unknown;
    props: Record<string, unknown>;
}

function isNode(value: unknown): value is Node {
    return (
        typeof value === 'object' &&
        value !== null &&
        'props' in value &&
        'type' in value
    );
}

/** 요소 트리를 깊이 우선으로 훑어 노드와 문자열 잎을 모은다. */
function walk(
    value: ReactNode | unknown,
    visit: (node: Node) => void,
    leaves: string[] = []
): string[] {
    if (typeof value === 'string' || typeof value === 'number') {
        leaves.push(String(value));
    } else if (Array.isArray(value)) {
        for (const child of value) walk(child, visit, leaves);
    } else if (isNode(value)) {
        visit(value);
        walk(value.props.children, visit, leaves);
    }
    return leaves;
}

function render(input: { bars: Bar[]; drawings: ChartDrawingSource | null }) {
    buildReportChartImage({
        symbol: 'AAPL',
        date: '2026-10-08',
        bars: input.bars,
        ma: {},
        drawings: input.drawings,
        cacheControl: 'no-store',
    });
    const nodes: Node[] = [];
    const leaves = walk(rendered.element as ReactElement, n => nodes.push(n));
    return { nodes, leaves };
}

const ofType = (nodes: Node[], type: string) =>
    nodes.filter(n => n.type === type);

describe('buildReportChartImage — 작도 요소 트리', () => {
    it('작도 없는 이미지는 캔들·이동평균만 있고 절대 위치 글자가 없다', () => {
        const { nodes } = render({ bars: bars(100), drawings: null });

        expect(ofType(nodes, 'rect')).toHaveLength(60);
        expect(ofType(nodes, 'g')).toHaveLength(60);
        expect(
            nodes.filter(
                n =>
                    typeof n.props.style === 'object' &&
                    (n.props.style as { position?: string }).position ===
                        'absolute'
            )
        ).toEqual([]);
    });

    it('작도가 안 맞으면(봉 시각 불일치) 작도 없는 이미지와 같다', () => {
        const shifted = {
            ...DRAWINGS,
            overlays: DRAWINGS.overlays.map(o => ({
                ...o,
                segments: o.segments.map(s => ({
                    ...s,
                    to: { ...s.to, time: s.to.time + 1 },
                })),
                levels: [],
                labels: [],
            })),
        };
        const { nodes } = render({ bars: bars(100), drawings: shifted });

        expect(ofType(nodes, 'g')).toHaveLength(60);
    });

    it('작도 선은 굵기 3의 선으로 그리고, 점선만 대시를 단다', () => {
        const { nodes } = render({ bars: bars(100), drawings: DRAWINGS });

        const overlayLines = ofType(nodes, 'line').filter(
            n => n.props.strokeWidth === 3
        );
        // 추세선 1(실선) + 파동 선분 1(점선) + 목표 레벨 1(점선)
        expect(overlayLines).toHaveLength(3);
        expect(overlayLines.map(n => n.props.strokeDasharray ?? null)).toEqual([
            null,
            '12 8',
            '12 8',
        ]);
        expect(
            overlayLines.every(n => typeof n.props.strokeOpacity === 'number')
        ).toBe(true);
    });

    it('수평 레벨은 plot 오른쪽 끝에서 끝나고 가격표는 그 바깥 여백에 둔다', () => {
        const { nodes, leaves } = render({
            bars: bars(100),
            drawings: DRAWINGS,
        });

        const levelLine = ofType(nodes, 'line').find(
            n => n.props.y1 === n.props.y2 && n.props.strokeWidth === 3
        );
        expect(levelLine?.props.x2).toBe(PLOT_WIDTH);
        const tag = nodes.find(
            n =>
                (n.props.style as { left?: number } | undefined)?.left ===
                PLOT_WIDTH + 10
        );
        expect(tag?.props.children).toBe('100.00');
        expect(leaves).toContain('1');
    });

    it('이미지 안의 글자는 라틴 글자·숫자뿐이다(번역 문구 없음)', () => {
        const { leaves } = render({ bars: bars(100), drawings: DRAWINGS });

        expect(leaves.length).toBeGreaterThan(0);
        for (const leaf of leaves) expect(leaf).toMatch(/^[\x20-\x7e]+$/);
    });
});
