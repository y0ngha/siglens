/**
 * 지표 메뉴 binding 조립 — 레지스트리 순서대로, 오버라이드가 있으면 그것을, 없으면 기본 on/off를 쓴다.
 */
import {
    INDICATOR_REGISTRY,
    type IndicatorBinding,
    type IndicatorKey,
} from '../model/indicatorRegistry';

/**
 * `INDICATOR_REGISTRY` 순서의 지표 메뉴 binding. 이평·밴드처럼 자기 훅이 상태를 가진 지표는
 * `overrides`에서, 나머지는 `visible[key]` + `toggle(key)`로 채운다.
 */
export function buildIndicatorBindings(
    overrides: Partial<Record<string, Omit<IndicatorBinding, 'meta'>>>,
    visible: Record<IndicatorKey, boolean>,
    toggle: (key: IndicatorKey) => void
): IndicatorBinding[] {
    return INDICATOR_REGISTRY.map(meta => {
        const override = overrides[meta.key];
        if (override !== undefined) return { meta, ...override };
        // INDICATOR_REGISTRY는 IndicatorKey 멤버로만 구성되므로 캐스트 안전.
        const key = meta.key as IndicatorKey;
        return { meta, active: visible[key], onToggle: () => toggle(key) };
    });
}
