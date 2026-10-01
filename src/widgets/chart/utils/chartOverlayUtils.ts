import type { ChartOverlay, OverlayLabel } from '@y0ngha/siglens-core';
import {
    ALTERNATE_OVERLAY_OPACITY,
    DIMMED_OVERLAY_OPACITY,
    HIGHLIGHT_LINE_WIDTH_MULT,
    type OverlayColorTable,
} from '../model/chartOverlayCategories';

const PRICE_PANE_INDEX = 0;

interface OverlayLinePoint {
    time: number;
    value: number;
}

interface OverlayMarker {
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
    /** 마지막 봉 ~ 가격축 앞까지 덧그릴지(수평 레벨만). */
    extendRight: boolean;
}

export interface OverlayLineSpecOptions {
    /** 꺼진 on/off 항목 key(`overlayItemKey`). */
    hiddenKeys: ReadonlySet<string>;
    /**
     * AI 패널 카드 hover·focus로 강조할 항목 key. **켜진 항목일 때만** 강조가 걸린다 —
     * 꺼진 작도를 강조로 흐리게라도 켜지 않는다(예전엔 강조가 그 종류 전체를 켜서
     * 메뉴에서 끈 원형 바닥이 상승 쐐기 강조와 함께 흐리게 나타났다).
     */
    highlightedKey: string | null;
    barTimes: ReadonlySet<number>;
    lastBarTime: number;
    /** RSI 패인이 꺼져 있으면 null. */
    rsiPaneIndex: number | null;
    colorFor: (overlay: ChartOverlay, role: string) => string;
    /** 수평 레벨을 가격축 앞까지 연장 — 사용자 설정(기본 켜짐). */
    extendLevelsRight: boolean;
    /** core가 내보내는 레벨 라벨(`breakout`, `61.8%` …)을 화면 문구로 바꾼다. 없으면 그대로. */
    levelLabelFor?: (label: string, overlay: ChartOverlay) => string;
}

/**
 * 로드된 봉의 시각 집합 — 작도가 봉에 맞는지(`isOverlayAlignedToBars`) 판정하는 기준.
 * 차트(`StockChart`)와 메뉴 항목 목록(`ChartContent`)이 같은 정의를 쓰도록 한 곳에 둔다.
 */
export function barTimesOf(bars: readonly { time: number }[]): Set<number> {
    return new Set(bars.map(b => b.time));
}

/**
 * 한 작도가 어느 on/off 항목에 속하는지.
 *
 * 추세선은 `sourceRef`가 전부 `'trendlines'`라 선마다 따로 켜고 끄려면 overlay id를
 * 쓴다. 나머지는 결과 카드(`patternSummaries[].id`·`strategyResults[].id`)가 단위다 —
 * 엘리어트 주/대안 파동처럼 한 카드가 작도 여러 개를 가져도 한 항목으로 움직인다.
 * 그리기·메뉴·AI 패널 버튼이 모두 이 key로 같은 상태를 읽는다.
 */
export function overlayItemKey(overlay: ChartOverlay): string {
    return overlay.kind === 'trendline' ? overlay.id : overlay.sourceRef;
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

/** 지금 로드된 봉 위에 실제로 선이 그려지는 오버레이인지 — 개수·강조 버튼의 공통 기준. */
export function isOverlayDrawn(
    overlay: ChartOverlay,
    barTimes: ReadonlySet<number>,
    lastBarTime: number
): boolean {
    return (
        isOverlayAlignedToBars(overlay, barTimes) &&
        hasDrawableLine(overlay, lastBarTime)
    );
}

/**
 * 켜진 채로 실제 그려지는 작도 중 수평 레벨을 가진 것이 있는지 — "레벨선 오른쪽 연장"
 * 설정 행을 띄울지의 기준. 레벨 작도를 전부 끈 상태에서 눌러도 아무것도 안 바뀌는
 * 스위치를 두지 않는다.
 */
export function hasDrawnLevels(
    overlays: readonly ChartOverlay[],
    {
        hiddenKeys,
        barTimes,
        lastBarTime,
    }: {
        hiddenKeys: ReadonlySet<string>;
        barTimes: ReadonlySet<number>;
        lastBarTime: number;
    }
): boolean {
    return overlays.some(
        o =>
            o.levels.length > 0 &&
            !hiddenKeys.has(overlayItemKey(o)) &&
            isOverlayDrawn(o, barTimes, lastBarTime)
    );
}

export type SegmentDirection = 'up' | 'down';

/**
 * 작도의 방향 — 첫 선분의 끝 가격이 시작보다 낮으면 하락. 추세선(기울기)·피보나치
 * 다리(다리: 시작→끝, ABC: A→B)가 같은 규칙을 쓴다. 같은 가격(core가 만들지 않는
 * 수평 선분)은 상승으로 둔다. 선분이 없으면 `null` — 기본값은 호출부가 정한다.
 */
export function firstSegmentDirection(
    segments: ChartOverlay['segments']
): SegmentDirection | null {
    const [s] = segments;
    if (s === undefined) return null;
    return s.to.price < s.from.price ? 'down' : 'up';
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
    const activeHighlight =
        opts.highlightedKey !== null &&
        !opts.hiddenKeys.has(opts.highlightedKey)
            ? opts.highlightedKey
            : null;
    return overlays.flatMap(overlay => {
        const key = overlayItemKey(overlay);
        if (
            opts.hiddenKeys.has(key) ||
            !isOverlayAlignedToBars(overlay, opts.barTimes)
        )
            return [];
        const highlighted = activeHighlight !== null && key === activeHighlight;
        const dimmed = activeHighlight !== null && !highlighted;
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
                        extendRight: false,
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
                              ? opts.levelLabelFor(l.label, overlay)
                              : l.label,
                          markers: [],
                          extendRight: opts.extendLevelsRight,
                      },
                  ]
        );
        const specs = [...segmentSpecs, ...levelSpecs];
        // 라벨은 가격 좌표라 가격 패인 스펙에만 붙인다 — core의 segments 순서에
        // 기대지 않는다(다이버전스는 price·rsi 선분이 한 오버레이에 섞인다).
        // 시각 정렬은 여기서 하지 않는다 — `useChartOverlays`가 라벨 전용 시리즈에
        // 데이터를 얹기 전에(엄격 오름차순 요구) 단 한 번 정렬 + 중복 제거한다.
        const labelHost = specs.findIndex(
            s => s.paneIndex === PRICE_PANE_INDEX
        );
        if (labelHost === -1 || overlay.labels.length === 0) return specs;
        const markers = overlay.labels.map(toMarker);
        return specs.map((s, i) => (i === labelHost ? { ...s, markers } : s));
    });
}

/** kind별 기본 색 + role별(support/resistance) 세분화, 패턴은 스킬 색 우선. */
export function overlayColorFor(
    overlay: ChartOverlay,
    role: string,
    patternColors: Readonly<Record<string, string>>,
    fallback: OverlayColorTable
): string {
    if (overlay.kind === 'pattern') {
        return patternColors[overlay.sourceRef] ?? fallback.pattern();
    }
    if (overlay.kind === 'trendline') {
        return role === 'resistance'
            ? fallback.resistance()
            : fallback.support();
    }
    return fallback[overlay.kind]();
}
