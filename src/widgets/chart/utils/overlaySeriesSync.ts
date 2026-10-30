/**
 * 작도 스펙 → 시리즈 동기화의 순수 판정 — 스펙의 기하 식별 key와 스타일 해석.
 *
 * `useChartOverlays`는 기하(점·패인·라벨·연장 여부)가 같은 스펙의 시리즈를 재사용하고
 * 스타일(색·두께·점선·제목)만 갱신한다. hover 강조·실시간 종가 변화처럼 스타일만 바뀌는
 * 갱신에서 시리즈를 통째로 지웠다 다시 만들지 않기 위해서다.
 */
import { LineStyle } from 'lightweight-charts';
import type { OverlayLineSpec } from './chartOverlayUtils';

/** lightweight-charts `LineWidth` 상한. */
const MAX_LINE_WIDTH = 4;

/** 시리즈에 입히는 스타일 — 기하가 같으면 이것만 바뀐다. */
export interface OverlaySeriesStyle {
    color: string;
    lineWidth: 1 | 2 | 3 | 4;
    lineStyle: LineStyle;
    dashed: boolean;
    title: string;
}

/** `#rrggbb`에 불투명도를 알파 채널로 붙인다. 다른 형식이거나 불투명이면 그대로. */
export function withOpacity(hex: string, opacity: number): string {
    if (opacity >= 1 || !/^#[0-9a-f]{6}$/i.test(hex)) return hex;
    return `${hex}${Math.round(opacity * 255)
        .toString(16)
        .padStart(2, '0')}`;
}

/**
 * 스펙의 화면 스타일. lightweight-charts `LineWidth`는 1~4 리터럴이다 — 양 끝을 잘라 그
 * 범위를 보장하므로 캐스트가 안전하다(강조 배수·기본 두께가 커져도 5 이상이 새지 않는다).
 */
export function overlaySeriesStyle(
    spec: OverlayLineSpec,
    lineWidth: number
): OverlaySeriesStyle {
    return {
        color: withOpacity(spec.color, spec.opacity),
        lineWidth: Math.min(
            MAX_LINE_WIDTH,
            Math.max(1, Math.round(lineWidth * spec.lineWidthMult))
        ) as 1 | 2 | 3 | 4,
        lineStyle: spec.dashed ? LineStyle.Dashed : LineStyle.Solid,
        dashed: spec.dashed,
        title: spec.title,
    };
}

/** 두 스타일이 같은가 — 같으면 `applyOptions`를 건너뛴다. */
export function isSameOverlayStyle(
    a: OverlaySeriesStyle,
    b: OverlaySeriesStyle
): boolean {
    return (
        a.color === b.color &&
        a.lineWidth === b.lineWidth &&
        a.dashed === b.dashed &&
        a.title === b.title
    );
}

/** 기하만으로 만든 식별 문자열 — 스타일 필드는 넣지 않는다. */
function geometrySignature(spec: OverlayLineSpec): string {
    return JSON.stringify([
        spec.paneIndex,
        spec.points.map(p => [p.time, p.value]),
        spec.markers.map(m => [m.time, m.price, m.position, m.text]),
        spec.extendRight,
    ]);
}

/**
 * 스펙마다 기하 key를 매긴다. 기하가 같은 스펙이 둘 이상이면 등장 순서(`#n`)로 구분해
 * key가 겹치지 않게 한다.
 */
export function overlayGeometryKeys(
    specs: readonly OverlayLineSpec[]
): string[] {
    const signatures = specs.map(geometrySignature);
    return signatures.map(
        (signature, i) =>
            `${signature}#${signatures.slice(0, i).filter(s => s === signature).length}`
    );
}
