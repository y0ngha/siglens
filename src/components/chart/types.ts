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
}
