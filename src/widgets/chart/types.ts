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
