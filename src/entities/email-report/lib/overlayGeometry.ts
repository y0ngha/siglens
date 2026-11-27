import type { Bar, ChartOverlay } from '@y0ngha/siglens-core';
import {
    buildOverlayLineSpecs,
    overlayColorFor,
    overlayItemKey,
} from '@/entities/analysis/lib/chartOverlays/chartOverlayUtils';
import { parseFibLevelLabel } from '@/entities/analysis/lib/chartOverlays/fibLevelLabel';
import { visibleLevelLabels } from '@/entities/analysis/lib/chartOverlays/levelLabelCulling';
import {
    buildOverlayMenuItems,
    patternPaletteByKey,
    type OverlayMenuItem,
} from '@/entities/analysis/lib/chartOverlays/overlayItems';
import { isReachedTarget } from '@/entities/analysis/lib/chartOverlays/reachedLevel';
import type { ChartDrawingSource } from '@/entities/analysis/lib/narrowChartDrawings';
import {
    barTimesOf,
    isOverlayAlignedToBars,
    overlayTimes,
} from '@/entities/analysis/lib/overlayAlignment';
import { CHART_COLORS } from '@/shared/lib/chartColors';
import { CHART_OVERLAY_COLORS } from '@/shared/lib/chartOverlayStyle';
import { dynamicDecimals } from '@/shared/lib/priceFormat';
import type { ReportLegendEntry } from '../reportModel';
import {
    REPORT_CHART_BARS,
    REPORT_CHART_MAX_BARS,
    type ChartGeometry,
} from './chartGeometry';

/** 오른쪽 여백에 붙는 가격표 둘 사이의 최소 간격(px) — 글자 22px에 여백을 더한 값. */
export const TAG_MIN_GAP = 30;

/** 이미지에 그리는 선 하나(plot 좌표). */
export interface DrawnLine {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    color: string;
    dashed: boolean;
    opacity: number;
}

/** 수평 레벨의 오른쪽 여백 가격표. 글자는 숫자·`%`뿐이라 로케일 글꼴이 필요 없다. */
export interface LevelTag {
    y: number;
    text: string;
    color: string;
    opacity: number;
}

/** 작도 점 라벨(파동 번호·`LS H RS` 등 core가 내는 라틴 글자). */
export interface PointLabel {
    x: number;
    y: number;
    text: string;
    position: 'above' | 'below';
    color: string;
}

export interface OverlayGeometry {
    lines: DrawnLine[];
    tags: LevelTag[];
    pointLabels: PointLabel[];
    /** 선이 하나라도 그려진 항목과 그 색 — 범례의 원료. */
    drawnItems: { item: OverlayMenuItem; color: string }[];
}

/**
 * 작도 때문에 봉 창을 넓힌다 — 가장 이른 작도 시각까지, 최대 {@link REPORT_CHART_MAX_BARS}봉. 상한 창에 시각이
 * 다 들어오지 않는 작도는 자르지 않고 뺀다(SIGLENS AI 차트 블록 `windowFor`와 같은 규칙).
 */
export function planDrawingWindow(
    bars: readonly Bar[],
    overlays: readonly ChartOverlay[]
): { windowSize: number; overlays: ChartOverlay[] } {
    const capTimes = barTimesOf(bars.slice(-REPORT_CHART_MAX_BARS));
    const fit = overlays.filter(o => isOverlayAlignedToBars(o, capTimes));
    const earliest = Math.min(...fit.flatMap(overlayTimes));
    const from = Number.isFinite(earliest)
        ? bars.findIndex(b => b.time >= earliest)
        : -1;
    const needed = from === -1 ? 0 : bars.length - from;
    return {
        windowSize: Math.min(
            REPORT_CHART_MAX_BARS,
            Math.max(REPORT_CHART_BARS, needed)
        ),
        overlays: fit,
    };
}

/** 오른쪽 여백 가격표의 가격 글자 — 1000 이상은 정수, 1 이상은 소수 둘째, 그 아래는 유효숫자를 살린다. */
export function formatLevelPrice(value: number): string {
    const digits = Math.abs(value) >= 1000 ? 0 : dynamicDecimals(value);
    return value.toLocaleString('en-US', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    });
}

/** 피보나치 레벨은 비율(`61.8%`), 나머지는 가격. */
function tagText(label: string, price: number): string {
    return parseFibLevelLabel(label)?.percent ?? formatLevelPrice(price);
}

const PATTERN_PALETTE = [
    CHART_COLORS.overlayPattern1,
    CHART_COLORS.overlayPattern2,
    CHART_COLORS.overlayPattern3,
    CHART_COLORS.overlayPattern4,
    CHART_COLORS.overlayPattern5,
    CHART_COLORS.overlayPattern6,
];

interface OverlayGeometryInput {
    /** 날짜 상한까지 자른 전체 봉. `geo.startIndex`부터가 보이는 창이다. */
    bars: readonly Bar[];
    geo: ChartGeometry;
    /** 작도를 그리는 영역의 폭(오른쪽 여백 제외). */
    plotWidth: number;
    /** 창에 시각이 모두 들어오는 작도(`planDrawingWindow`). */
    overlays: readonly ChartOverlay[];
    drawings: Pick<ChartDrawingSource, 'overlayColors' | 'overlayLabels'>;
}

/**
 * 작도를 픽셀 좌표의 선·가격표·점 라벨로 바꾼다. 선 스펙은 사이트 차트와 같은 `buildOverlayLineSpecs`가 만들고(모든
 * 항목 켬, RSI 패인 없음, 수평 레벨은 오른쪽 끝까지), 색 규칙도 `useChartOverlaySpecs`와 같다.
 *
 * 가격축은 캔들·이동평균으로만 정해진다(사이트 작도 시리즈도 축에 기여하지 않는다) — 축 밖 수평 레벨은 그리지
 * 않고, 선분은 한쪽이라도 축 안에 있으면 그리되 호출자가 plot 영역으로 자른다.
 */
export function computeOverlayGeometry({
    bars,
    geo,
    plotWidth,
    overlays,
    drawings,
}: OverlayGeometryInput): OverlayGeometry {
    const visible = bars.slice(geo.startIndex);
    const lastBar = visible.at(-1);
    const empty: OverlayGeometry = {
        lines: [],
        tags: [],
        pointLabels: [],
        drawnItems: [],
    };
    if (lastBar === undefined) return empty;
    const barTimes = barTimesOf(visible);
    const indexOfTime = new Map(visible.map((b, i) => [b.time, i]));
    const lastBarTime = lastBar.time;
    const items = buildOverlayMenuItems(overlays, {
        barTimes,
        lastBarTime,
        labelFor: ref => drawings.overlayLabels[ref],
        hasActionPrices: false,
    });
    const palette = patternPaletteByKey(items, PATTERN_PALETTE);
    const inRange = (price: number) => price >= geo.low && price <= geo.high;

    const drawn = overlays.flatMap(overlay =>
        buildOverlayLineSpecs([overlay], {
            hiddenKeys: new Set(),
            highlightedKey: null,
            barTimes,
            lastBarTime,
            rsiPaneIndex: null,
            colorFor: (o, role) =>
                (o.kind === 'pattern' ? palette.get(o.sourceRef) : undefined) ??
                overlayColorFor(
                    o,
                    role,
                    drawings.overlayColors,
                    CHART_OVERLAY_COLORS
                ),
            extendLevelsRight: true,
            isReachedLevel: (level, o) =>
                isReachedTarget(level, o, lastBar.close),
        }).map(spec => ({ key: overlayItemKey(overlay), spec }))
    );

    const placed = drawn.flatMap(({ key, spec }) => {
        const [from, to] = spec.points;
        const i1 = indexOfTime.get(from.time);
        const i2 = indexOfTime.get(to.time);
        if (i1 === undefined || i2 === undefined) return [];
        const level = spec.extendRight;
        // 수평 레벨은 가격이 축 밖이면 통째로 뺀다. 선분은 두 끝이 같은 쪽 밖일 때만 뺀다.
        const visibleOnAxis = level
            ? inRange(from.value)
            : inRange(from.value) ||
              inRange(to.value) ||
              from.value < geo.low !== to.value < geo.low;
        if (!visibleOnAxis) return [];
        return [
            {
                key,
                spec,
                line: {
                    x1: geo.xAt(i1),
                    y1: geo.yAt(from.value),
                    x2: level ? plotWidth : geo.xAt(i2),
                    y2: geo.yAt(to.value),
                    color: spec.color,
                    dashed: spec.dashed,
                    opacity: spec.opacity,
                } satisfies DrawnLine,
            },
        ];
    });

    const levels = placed.filter(p => p.spec.extendRight);
    const keep = visibleLevelLabels(
        levels.map(p => ({
            y: p.line.y1,
            priority: p.spec.labelPriority,
        })),
        TAG_MIN_GAP
    );
    const tags = levels.flatMap((p, i) =>
        keep.has(i)
            ? [
                  {
                      y: p.line.y1,
                      text: tagText(p.spec.title, p.spec.points[0].value),
                      color: p.spec.color,
                      opacity: p.spec.opacity,
                  },
              ]
            : []
    );

    const pointLabels = placed.flatMap(({ spec }) =>
        spec.markers.flatMap(marker => {
            const index = indexOfTime.get(marker.time);
            if (index === undefined || !inRange(marker.price)) return [];
            return [
                {
                    x: geo.xAt(index),
                    y: geo.yAt(marker.price),
                    text: marker.text,
                    position:
                        marker.position === 'aboveBar'
                            ? ('above' as const)
                            : ('below' as const),
                    color: spec.color,
                },
            ];
        })
    );

    // 항목의 색은 그 항목에서 처음 그려진 선의 색 — 뒤집어 넣어 앞선 선이 마지막에 덮게 한다.
    const colorByKey = new Map(
        placed.toReversed().map(({ key, line }) => [key, line.color])
    );
    return {
        lines: placed.map(p => p.line),
        tags,
        pointLabels,
        drawnItems: items.flatMap(item => {
            const color = colorByKey.get(item.key);
            return color === undefined ? [] : [{ item, color }];
        }),
    };
}

/**
 * 범례 칸으로 묶는다. 추세선은 방향별 한 칸, 카드 없는 종류(피보나치·다이버전스·엘리어트)는 종류별 한 칸, 카드는
 * 스킬 이름별 한 칸이다. 이름을 모르는 카드는 칸을 만들지 않는다 — 내부 id가 메일에 새지 않게 한다.
 */
export function toLegendEntries(
    drawnItems: OverlayGeometry['drawnItems'],
    overlayLabels: Readonly<Record<string, string>>
): ReportLegendEntry[] {
    const seen = new Set<string>();
    return drawnItems.flatMap(({ item, color }): ReportLegendEntry[] => {
        const entry = legendEntryOf(item, color, overlayLabels);
        if (entry === null) return [];
        const id = entry.kind === 'card' ? `card:${entry.name}` : entry.kind;
        if (seen.has(id)) return [];
        seen.add(id);
        return [entry];
    });
}

function legendEntryOf(
    item: OverlayMenuItem,
    color: string,
    overlayLabels: Readonly<Record<string, string>>
): ReportLegendEntry | null {
    if (item.kind === 'action') return null;
    if (item.kind === 'trendline')
        return {
            kind: item.direction === 'up' ? 'trendUp' : 'trendDown',
            color,
        };
    if (item.label === null) return { kind: item.kind, color };
    const name = overlayLabels[item.key];
    return name === undefined ? null : { kind: 'card', name, color };
}
