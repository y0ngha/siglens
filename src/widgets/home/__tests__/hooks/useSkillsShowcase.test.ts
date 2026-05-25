// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react';

import { useSkillsShowcase } from '../../hooks/useSkillsShowcase';

describe('useSkillsShowcase', () => {
    it('initializes with "all" tab and showAll=false', () => {
        const { result } = renderHook(() => useSkillsShowcase());

        expect(result.current.activeTab).toBe('all');
        expect(result.current.showAll).toBe(false);
    });

    it('changes the active tab on handleTabSelect', () => {
        const { result } = renderHook(() => useSkillsShowcase());

        act(() => result.current.handleTabSelect('pattern'));

        expect(result.current.activeTab).toBe('pattern');
    });

    it('resets showAll when switching tabs', () => {
        const { result } = renderHook(() => useSkillsShowcase());

        act(() => result.current.toggleShowAll());
        expect(result.current.showAll).toBe(true);

        act(() => result.current.handleTabSelect('strategy'));
        expect(result.current.showAll).toBe(false);
    });

    it('toggles showAll', () => {
        const { result } = renderHook(() => useSkillsShowcase());

        act(() => result.current.toggleShowAll());
        expect(result.current.showAll).toBe(true);

        act(() => result.current.toggleShowAll());
        expect(result.current.showAll).toBe(false);
    });

    it('provides a stable baseId', () => {
        const { result } = renderHook(() => useSkillsShowcase());

        expect(typeof result.current.baseId).toBe('string');
        expect(result.current.baseId.length).toBeGreaterThan(0);
    });
});
