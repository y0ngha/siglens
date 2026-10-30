import { buildIndicatorBindings } from '../../utils/indicatorBindings';
import {
    INDICATOR_REGISTRY,
    type IndicatorKey,
} from '../../model/indicatorRegistry';

const allOff = Object.fromEntries(
    INDICATOR_REGISTRY.map(meta => [meta.key, false])
) as Record<IndicatorKey, boolean>;

describe('buildIndicatorBindings', () => {
    it('레지스트리 순서대로 binding을 만든다', () => {
        const bindings = buildIndicatorBindings({}, allOff, vi.fn());
        expect(bindings.map(b => b.meta.key)).toEqual(
            INDICATOR_REGISTRY.map(meta => meta.key)
        );
    });

    it('오버라이드가 있으면 그것을 쓰고, 없으면 기본 on/off로 토글한다', () => {
        const toggle = vi.fn();
        const onToggle = vi.fn();
        const [first, second] = INDICATOR_REGISTRY;
        const bindings = buildIndicatorBindings(
            { [first.key]: { active: true, onToggle } },
            { ...allOff, [second.key as IndicatorKey]: true },
            toggle
        );
        expect(bindings[0]).toMatchObject({ active: true, onToggle });
        expect(bindings[1].active).toBe(true);
        bindings[1].onToggle?.();
        expect(toggle).toHaveBeenCalledWith(second.key);
    });
});
