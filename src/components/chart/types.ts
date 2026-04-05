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

export interface PaneIndices {
    rsi: number;
    macd: number;
    dmi: number;
    stochastic: number;
    stochRsi: number;
    cci: number;
}
