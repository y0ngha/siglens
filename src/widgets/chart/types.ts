/**
 * 차트 위젯 공용 타입(오버레이 범례 항목, pane 라벨, 토글 설정 등).
 */

import type { IndicatorKey } from './model/indicatorRegistry';

export interface OverlayItemBase {
    name: string;
    color: string;
}

export interface OverlayLegendItem extends OverlayItemBase {
    value: number | null;
}

export interface PaneSubLabel {
    name: string;
    color: string;
}

export interface PaneLabelConfig {
    paneIndex: number;
    subLabels: PaneSubLabel[];
}

export type PaneIndices = Record<IndicatorKey, number>;

/** 표시 환경설정 토글 하나 — 값과 변경 콜백(오른쪽 연장·시간외 표시 등). */
export interface ToggleSetting {
    checked: boolean;
    onChange: (checked: boolean) => void;
}
