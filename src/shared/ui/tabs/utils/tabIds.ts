export interface TabItem<T extends string> {
    value: T;
    label: string;
}

// 동일 prefix를 사용하는 외부 패널의 id/aria-labelledby를 맞추기 위한 헬퍼.
export function buildTabId(prefix: string, value: string): string {
    return `${prefix}-tab-${value}`;
}

export function buildPanelId(prefix: string, value: string): string {
    return `${prefix}-panel-${value}`;
}
