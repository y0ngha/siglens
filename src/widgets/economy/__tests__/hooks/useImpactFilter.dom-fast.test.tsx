import { act, renderHook } from '@testing-library/react';
import { useImpactFilter } from '@/widgets/economy/hooks/useImpactFilter';

describe('useImpactFilter', () => {
    it('기본은 High·Medium이고 토글로 켜고 끈다', () => {
        const { result } = renderHook(() => useImpactFilter());
        expect([...result.current.activeImpacts]).toEqual(['High', 'Medium']);

        act(() => result.current.toggleImpact('Low'));
        expect(result.current.activeImpacts.has('Low')).toBe(true);

        act(() => result.current.toggleImpact('High'));
        expect(result.current.activeImpacts.has('High')).toBe(false);
    });
});
