/** 탭 하나의 식별 값과 화면 라벨. */
export interface TabItem<T extends string> {
    value: T;
    label: string;
}

/** 동일 prefix를 쓰는 외부 패널의 `aria-labelledby`를 탭 id와 맞추기 위한 헬퍼. */
export function buildTabId(prefix: string, value: string): string {
    return `${prefix}-tab-${value}`;
}

/** `buildTabId`와 같은 prefix로 만든 패널 id — 패널의 `id`와 탭의 `aria-controls`가 일치해야 한다. */
export function buildPanelId(prefix: string, value: string): string {
    return `${prefix}-panel-${value}`;
}
