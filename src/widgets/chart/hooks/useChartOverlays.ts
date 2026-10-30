'use client';

/**
 * AI 작도(`chartOverlays`) 스펙을 가격 차트 시리즈로 동기화하는 훅.
 */
import type { RefObject } from 'react';
import { useEffect, useRef } from 'react';
import {
    createSeriesMarkers,
    LineSeries,
    type IChartApi,
    type ISeriesApi,
    type ISeriesMarkersPluginApi,
    type ISeriesPrimitive,
    type SeriesMarker,
    type Time,
} from 'lightweight-charts';
import type { OverlayLineSpec } from '../utils/chartOverlayUtils';
import {
    isSameOverlayStyle,
    overlayGeometryKeys,
    overlaySeriesStyle,
    type OverlaySeriesStyle,
} from '../utils/overlaySeriesSync';
import { DEFAULT_LINE_WIDTH } from '../constants';
import { createRightExtendPrimitive } from '../utils/rightExtendPrimitive';
import { visibleLevelLabels } from '../utils/levelLabelCulling';

const OVERLAY_SERIES_OPTIONS = {
    lastValueVisible: false,
    priceLineVisible: false,
    crosshairMarkerVisible: false,
    // 오버레이가 가격축 범위를 넓히면 캔들이 납작해진다 — 자동 스케일에서 뺀다.
    autoscaleInfoProvider: () => null,
} as const;

/**
 * 가격축 라벨 두 개가 겹치지 않을 중심 간 최소 거리 — 글자 크기에 위아래 여백을 더한다.
 * lightweight-charts의 축 라벨 높이(글자 + 상하 패딩)와 맞춘 값이다.
 */
const LABEL_VERTICAL_PADDING_PX = 8;
/** 차트 옵션에 글자 크기가 없을 때 — lightweight-charts `layout.fontSize` 기본값. */
const DEFAULT_AXIS_FONT_SIZE_PX = 12;

interface TitledSeries {
    series: ISeriesApi<'Line'>;
    title: string;
    price: number;
    priority: number;
    /** 이 시리즈의 엔트리 — 지금 입혀 둔 제목(`appliedTitle`)을 읽고 쓴다. */
    entry: OverlayEntry;
}

/**
 * 겹치는 레벨 라벨을 숨기고 겹치지 않게 된 라벨은 되살린다.
 *
 * 라벨 y좌표는 스크롤·확대·가격축 드래그·리사이즈마다 바뀐다. 시간축 범위·크기 변화는
 * 구독으로, 가격축 드래그·휠은 차트 DOM의 포인터 이벤트로 잡고, 한 프레임에 한 번만
 * 다시 잰다.
 *
 * 한계: 실시간 봉 갱신으로 자동 스케일만 조금 바뀌는 경우는 잡지 않는다 —
 * lightweight-charts에 가격축 범위 변경 이벤트가 없다. 그 변화는 몇 px 수준이라
 * 겹침 판정이 바뀌는 일이 드물고, 다음 스크롤·포인터 조작에서 다시 판정된다.
 */
function attachLabelCulling(
    chart: IChartApi,
    titled: TitledSeries[]
): () => void {
    if (titled.length === 0) return () => {};

    const apply = () => {
        const minGap =
            (chart.options().layout.fontSize ?? DEFAULT_AXIS_FONT_SIZE_PX) +
            LABEL_VERTICAL_PADDING_PX;
        const visible = visibleLevelLabels(
            titled.map(t => ({
                y: t.series.priceToCoordinate(t.price),
                priority: t.priority,
            })),
            minGap
        );
        titled.forEach((t, i) => {
            const next = visible.has(i) ? t.title : '';
            if (next === t.entry.appliedTitle) return;
            t.entry.appliedTitle = next;
            t.series.applyOptions({ title: next });
        });
    };

    let frame: number | null = null;
    const schedule = () => {
        if (frame !== null) return;
        frame = requestAnimationFrame(() => {
            frame = null;
            apply();
        });
    };

    const timeScale = chart.timeScale();
    const element = chart.chartElement();
    timeScale.subscribeVisibleLogicalRangeChange(schedule);
    timeScale.subscribeSizeChange(schedule);
    element.addEventListener('pointerup', schedule);
    element.addEventListener('wheel', schedule, { passive: true });
    element.addEventListener('dblclick', schedule);
    schedule();

    return () => {
        if (frame !== null) cancelAnimationFrame(frame);
        timeScale.unsubscribeVisibleLogicalRangeChange(schedule);
        timeScale.unsubscribeSizeChange(schedule);
        element.removeEventListener('pointerup', schedule);
        element.removeEventListener('wheel', schedule);
        element.removeEventListener('dblclick', schedule);
    };
}

interface UseChartOverlaysParams {
    chartRef: RefObject<IChartApi | null>;
    specs: readonly OverlayLineSpec[];
    lineWidth?: number;
}

/** 스펙 하나가 차트에 만든 것 — 기하가 같은 동안 재사용한다. */
interface OverlayEntry {
    series: ISeriesApi<'Line'>;
    /** 라벨 전용 투명 시리즈와 그 마커 — 라벨이 없으면 null. */
    label: {
        series: ISeriesApi<'Line'>;
        markers: ISeriesMarkersPluginApi<Time>;
    } | null;
    /** 레벨 오른쪽 연장 primitive — `extendRight`가 아니면 null. */
    primitive: ISeriesPrimitive<Time> | null;
    style: OverlaySeriesStyle;
    /**
     * 지금 시리즈에 입혀 둔 제목 — 겹침 판정(`attachLabelCulling`)이 숨기면 `''`. 엔트리를
     * 재사용하는 동안 유지돼야 다음 판정이 "이미 숨김"을 알고 되살린다. 불변성 규칙의
     * 의도된 예외다: 렌더와 무관한 effect 안의 명령형 캐시이고 훅 밖으로 나가지 않는다.
     */
    appliedTitle: string;
}

/** 라벨 마커 — 정렬된 마커 배열을 스펙 색으로 만든다. */
function labelMarkers(
    sortedMarkers: readonly OverlayLineSpec['markers'][number][],
    color: string
): SeriesMarker<Time>[] {
    return sortedMarkers.map(m => ({
        time: m.time as Time,
        position: m.position,
        shape: 'circle',
        size: 0,
        color,
        text: m.text,
    }));
}

/** 정렬된 마커 — 라벨 시리즈 데이터와 마커가 같은 순서를 공유한다. */
function sortedMarkersOf(spec: OverlayLineSpec) {
    return spec.markers.toSorted((a, b) => a.time - b.time);
}

function attachExtendPrimitive(
    series: ISeriesApi<'Line'>,
    spec: OverlayLineSpec,
    style: OverlaySeriesStyle
): ISeriesPrimitive<Time> | null {
    if (!spec.extendRight) return null;
    const [, end] = spec.points;
    // core 작도 시각은 봉 시각과 같은 UTC 초(UTCTimestamp)라 `Time`으로 그대로 쓸 수 있다.
    const primitive = createRightExtendPrimitive({
        startTime: end.time as Time,
        price: end.value,
        color: style.color,
        lineWidth: style.lineWidth,
        dashed: style.dashed,
    });
    series.attachPrimitive(primitive);
    return primitive;
}

/** 스펙 하나의 시리즈(+라벨 시리즈·연장 primitive)를 새로 만든다. */
function createOverlayEntry(
    chart: IChartApi,
    spec: OverlayLineSpec,
    style: OverlaySeriesStyle
): OverlayEntry {
    const series = chart.addSeries(
        LineSeries,
        {
            ...OVERLAY_SERIES_OPTIONS,
            color: style.color,
            lineWidth: style.lineWidth,
            lineStyle: style.lineStyle,
            title: style.title,
        },
        spec.paneIndex
    );
    series.setData(
        spec.points.map(p => ({ time: p.time as Time, value: p.value }))
    );
    const primitive = attachExtendPrimitive(series, spec, style);
    if (spec.markers.length === 0)
        return {
            series,
            label: null,
            primitive,
            style,
            appliedTitle: style.title,
        };

    // 라벨 전용 투명 시리즈 — 값은 라벨 가격이다(0을 넣으면 aboveBar/belowBar 배치가 항상
    // 바닥 기준이 된다).
    const labelSeries = chart.addSeries(
        LineSeries,
        { ...OVERLAY_SERIES_OPTIONS, color: 'transparent', lineVisible: false },
        spec.paneIndex
    );
    const sortedMarkers = sortedMarkersOf(spec);
    // 시리즈 데이터는 시각이 엄격히 오름차순이어야 한다 — 같은 봉에 라벨이 둘(예: 한 봉의
    // 고가·저가가 모두 피벗)이면 첫 점만 남긴다. 마커는 같은 시각에 여러 개 달 수 있다.
    labelSeries.setData(
        sortedMarkers
            .filter((m, i, arr) => i === 0 || m.time !== arr[i - 1].time)
            .map(m => ({ time: m.time as Time, value: m.price }))
    );
    const markers = createSeriesMarkers(
        labelSeries,
        labelMarkers(sortedMarkers, style.color)
    );
    return {
        series,
        label: { series: labelSeries, markers },
        primitive,
        style,
        appliedTitle: style.title,
    };
}

/** 기하가 같은 기존 시리즈에 바뀐 스타일만 입힌다. */
function restyleOverlayEntry(
    entry: OverlayEntry,
    spec: OverlayLineSpec,
    style: OverlaySeriesStyle
): OverlayEntry {
    if (isSameOverlayStyle(entry.style, style)) return entry;
    entry.series.applyOptions({
        color: style.color,
        lineWidth: style.lineWidth,
        lineStyle: style.lineStyle,
        title: style.title,
    });
    entry.label?.markers.setMarkers(
        labelMarkers(sortedMarkersOf(spec), style.color)
    );
    // primitive는 생성 시 스타일을 굳히므로 갈아 끼운다(그리기만 하는 가벼운 객체다).
    if (entry.primitive !== null) entry.series.detachPrimitive(entry.primitive);
    return {
        ...entry,
        primitive: attachExtendPrimitive(entry.series, spec, style),
        style,
        appliedTitle: style.title,
    };
}

/** 차트에서 엔트리의 시리즈를 뗀다. 차트가 먼저 제거된 경우(언마운트 순서)는 무시한다. */
function removeOverlayEntry(chart: IChartApi, entry: OverlayEntry): void {
    [entry.series, entry.label?.series]
        .filter(s => s !== undefined)
        .forEach(s => {
            try {
                chart.removeSeries(s);
            } catch {
                // 차트가 먼저 제거됐다 — 시리즈도 함께 사라졌다.
            }
        });
}

/**
 * `chartOverlays[]`(패턴·추세선·다이버전스·피보나치·엘리어트)를 `LineSeries`로
 * 그린다. 하나의 스펙 = 선분 하나(2점) 또는 레벨 하나(수평선) = 시리즈 하나.
 * 레벨 스펙(`extendRight`)은 primitive로 마지막 봉 ~ 가격축 앞까지 덧그린다.
 * 레벨 제목끼리 화면에서 겹치면 우선순위가 낮은 쪽을 숨긴다(`attachLabelCulling`).
 *
 * 라벨(HS의 LS/H/RS 등)은 선분/레벨 시리즈 위가 아니라 **라벨 전용 투명
 * 시리즈**에 마커로 단다 — 라벨 시각이 선분의 두 끝점 밖일 수 있어(예: 헤드
 * 라벨이 첫 세그먼트 범위 밖) lightweight-charts 마커가 그 시리즈 데이터에
 * 없는 시각을 그릴 수 없기 때문이다.
 *
 * 스펙이 바뀌면 **기하 key**(`overlayGeometryKeys`)로 맞춰 본다 — 기하가 같은 스펙은
 * 시리즈를 재사용해 스타일만 갱신하고, 사라진 스펙만 지우고 새 스펙만 만든다. hover 강조나
 * 실시간 종가 변화가 매번 수십 개 시리즈를 지웠다 다시 만들던 깜빡임을 없앤다.
 */
export function useChartOverlays({
    chartRef,
    specs,
    lineWidth = DEFAULT_LINE_WIDTH,
}: UseChartOverlaysParams): void {
    const entriesRef = useRef<Map<string, OverlayEntry>>(new Map());

    useEffect(() => {
        const chart = chartRef.current;
        if (!chart) return;

        const keys = overlayGeometryKeys(specs);
        const keySet = new Set(keys);
        const previous = entriesRef.current;
        [...previous]
            .filter(([key]) => !keySet.has(key))
            .forEach(([, entry]) => removeOverlayEntry(chart, entry));

        const next = new Map(
            specs.map((spec, i) => {
                const style = overlaySeriesStyle(spec, lineWidth);
                const existing = previous.get(keys[i]);
                return [
                    keys[i],
                    existing === undefined
                        ? createOverlayEntry(chart, spec, style)
                        : restyleOverlayEntry(existing, spec, style),
                ] as const;
            })
        );
        entriesRef.current = next;

        const titled: TitledSeries[] = specs.flatMap((spec, i) =>
            spec.title === ''
                ? []
                : [
                      {
                          series: next.get(keys[i])!.series,
                          title: spec.title,
                          price: spec.points[1].value,
                          priority: spec.labelPriority,
                          entry: next.get(keys[i])!,
                      },
                  ]
        );
        const detachCulling = attachLabelCulling(chart, titled);
        return () => {
            try {
                detachCulling();
            } catch {
                // 차트가 먼저 제거된 경우(언마운트 순서) — 무시.
            }
        };
    }, [chartRef, specs, lineWidth]);

    // 언마운트 시에만 모든 시리즈를 뗀다 — 스펙 변경 사이에는 위 effect가 차이만 반영한다.
    useEffect(() => {
        const chart = chartRef.current;
        const entries = entriesRef;
        return () => {
            if (chart)
                entries.current.forEach(entry =>
                    removeOverlayEntry(chart, entry)
                );
            entries.current = new Map();
        };
    }, [chartRef]);
}
