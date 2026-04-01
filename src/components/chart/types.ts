export interface PaneSubLabel {
    name: string;
    color: string;
}

export interface PaneLabelConfig {
    paneIndex: number;
    title: string;
    subLabels: PaneSubLabel[];
}
