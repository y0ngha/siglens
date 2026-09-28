import type {
    ChartOverlay,
    OverlayKind,
    OverlayLabel,
} from '@y0ngha/siglens-core';
import {
    ALTERNATE_OVERLAY_OPACITY,
    DIMMED_OVERLAY_OPACITY,
    HIGHLIGHT_LINE_WIDTH_MULT,
} from '../model/chartOverlayCategories';

const PRICE_PANE_INDEX = 0;

export interface OverlayLinePoint {
    time: number;
    value: number;
}

export interface OverlayMarker {
    time: number;
    position: 'aboveBar' | 'belowBar';
    text: string;
    /** 라벨 전용 시리즈의 값 — `aboveBar`/`belowBar`가 이 값을 기준으로 배치된다. */
    price: number;
}

/** LineSeries 하나 = 선분 하나(2점) 또는 수평 레벨 하나. */
export interface OverlayLineSpec {
    paneIndex: number;
    points: [OverlayLinePoint, OverlayLinePoint];
    color: string;
    dashed: boolean;
    opacity: number;
    lineWidthMult: number;
    /** 레벨 라벨(가격축 옆 title). */
    title: string;
    markers: OverlayMarker[];
}

export interface OverlayLineSpecOptions {
    visible: Readonly<Record<OverlayKind, boolean>>;
    highlightedSourceRef: string | null;
    barTimes: ReadonlySet<number>;
    lastBarTime: number;
    /** RSI 패인이 꺼져 있으면 null. */
    rsiPaneIndex: number | null;
    colorFor: (overlay: ChartOverlay, role: string) => string;
    /** core가 내보내는 레벨 라벨(`breakout`, `61.8%` …)을 화면 문구로 바꾼다. 없으면 그대로. */
    levelLabelFor?: (label: string) => string;
}

/**
 * 오버레이의 모든 기준 시각이 지금 로드된 봉에 있는지. 다른 timeframe의
 * 분석이 잠깐 남아 있거나 봉 창이 좁아졌을 때 엉뚱한 위치에 그리지 않게 한다.
 */
export function isOverlayAlignedToBars(
    overlay: ChartOverlay,
    barTimes: ReadonlySet<number>
): boolean {
    const times = [
        ...overlay.segments.flatMap(s => [s.from.time, s.to.time]),
        ...overlay.levels.map(l => l.fromTime),
        ...overlay.labels.map(l => l.at.time),
    ];
    return times.every(t => barTimes.has(t));
}

/**
 * 실제로 선이 하나라도 그려지는지 — 앞으로 가는 선분이나 오른쪽 끝 이전에 시작하는
 * 레벨이 있어야 한다. `buildOverlayLineSpecs`와 같은 조건이라, 드롭다운 개수가
 * 차트에 아무것도 없는 오버레이를 세지 않는다.
 */
function hasDrawableLine(overlay: ChartOverlay, lastBarTime: number): boolean {
    return (
        overlay.segments.some(s => s.to.time > s.from.time) ||
        overlay.levels.some(l => l.fromTime < lastBarTime)
    );
}

export function countOverlaysByKind(
    overlays: readonly ChartOverlay[],
    barTimes: ReadonlySet<number>,
    lastBarTime: number
): Record<OverlayKind, number> {
    const counts: Record<OverlayKind, number> = {
        pattern: 0,
        trendline: 0,
        divergence: 0,
        fibonacci: 0,
        elliott: 0,
    };
    for (const o of overlays)
        if (
            isOverlayAlignedToBars(o, barTimes) &&
            hasDrawableLine(o, lastBarTime)
        )
            counts[o.kind]++;
    return counts;
}

const toMarker = (l: OverlayLabel): OverlayMarker => ({
    time: l.at.time,
    position: l.position === 'above' ? 'aboveBar' : 'belowBar',
    text: l.text,
    price: l.at.price,
});

export function buildOverlayLineSpecs(
    overlays: readonly ChartOverlay[],
    opts: OverlayLineSpecOptions
): OverlayLineSpec[] {
    return overlays.flatMap(overlay => {
        if (
            !opts.visible[overlay.kind] ||
            !isOverlayAlignedToBars(overlay, opts.barTimes)
        )
            return [];
        const highlighted =
            opts.highlightedSourceRef !== null &&
            overlay.sourceRef === opts.highlightedSourceRef;
        const dimmed = opts.highlightedSourceRef !== null && !highlighted;
        const opacity = dimmed
            ? DIMMED_OVERLAY_OPACITY
            : overlay.variant === 'alternate'
              ? ALTERNATE_OVERLAY_OPACITY
              : 1;
        const lineWidthMult = highlighted ? HIGHLIGHT_LINE_WIDTH_MULT : 1;

        const segmentSpecs = overlay.segments.flatMap(
            (s): OverlayLineSpec[] => {
                if (s.to.time <= s.from.time) return [];
                const paneIndex =
                    s.pane === 'rsi' ? opts.rsiPaneIndex : PRICE_PANE_INDEX;
                if (paneIndex === null) return [];
                return [
                    {
                        paneIndex,
                        points: [
                            { time: s.from.time, value: s.from.price },
                            { time: s.to.time, value: s.to.price },
                        ],
                        color: opts.colorFor(overlay, s.role),
                        dashed: s.style === 'dashed',
                        opacity,
                        lineWidthMult,
                        title: '',
                        markers: [],
                    },
                ];
            }
        );
        const levelSpecs = overlay.levels.flatMap((l): OverlayLineSpec[] =>
            l.fromTime >= opts.lastBarTime
                ? []
                : [
                      {
                          paneIndex: PRICE_PANE_INDEX,
                          points: [
                              { time: l.fromTime, value: l.price },
                              { time: opts.lastBarTime, value: l.price },
                          ],
                          color: opts.colorFor(overlay, 'level'),
                          dashed: true,
                          opacity,
                          lineWidthMult,
                          title: opts.levelLabelFor
                              ? opts.levelLabelFor(l.label)
                              : l.label,
                          markers: [],
                      },
                  ]
        );
        const specs = [...segmentSpecs, ...levelSpecs];
        // 시각 정렬은 여기서 하지 않는다 — `useChartOverlays`가 라벨 전용 시리즈에
        // 데이터를 얹기 전에(엄격 오름차순 요구) 단 한 번 정렬 + 중복 제거한다.
        if (specs.length > 0 && overlay.labels.length > 0) {
            specs[0] = {
                ...specs[0],
                markers: overlay.labels.map(toMarker),
            };
        }
        return specs;
    });
}

/** kind별 기본 색 + role별(support/resistance) 세분화, 패턴은 스킬 색 우선. */
export function overlayColorFor(
    overlay: ChartOverlay,
    role: string,
    patternColors: Readonly<Record<string, string>>,
    fallback: Readonly<Record<string, () => string>>
): string {
    if (overlay.kind === 'pattern') {
        return patternColors[overlay.sourceRef] ?? fallback.pattern();
    }
    if (overlay.kind === 'trendline') {
        return role === 'resistance'
            ? fallback.resistance()
            : fallback.support();
    }
    return fallback[overlay.kind]?.() ?? fallback.pattern();
}
