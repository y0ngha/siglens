export interface OverlayLegendItem {
    name: string;
    color: string;
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
