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

    it('initializes with expandedKey=null', () => {
        const { result } = renderHook(() => useSkillsShowcase());

        expect(result.current.expandedKey).toBeNull();
    });

    it('sets expandedKey on toggleExpanded', () => {
        const { result } = renderHook(() => useSkillsShowcase());

        act(() => result.current.toggleExpanded('RSI'));

        expect(result.current.expandedKey).toBe('RSI');
    });

    it('collapses when the same key is toggled again', () => {
        const { result } = renderHook(() => useSkillsShowcase());

        act(() => result.current.toggleExpanded('RSI'));
        act(() => result.current.toggleExpanded('RSI'));

        expect(result.current.expandedKey).toBeNull();
    });

    it('switches expansion to another key (accordion — only one open)', () => {
        const { result } = renderHook(() => useSkillsShowcase());

        act(() => result.current.toggleExpanded('RSI'));
        act(() => result.current.toggleExpanded('MACD'));

        expect(result.current.expandedKey).toBe('MACD');
    });

    it('resets expandedKey when switching tabs', () => {
        const { result } = renderHook(() => useSkillsShowcase());

        act(() => result.current.toggleExpanded('RSI'));
        act(() => result.current.handleTabSelect('pattern'));

        expect(result.current.expandedKey).toBeNull();
    });

    it('resets expandedKey when toggling showAll', () => {
        const { result } = renderHook(() => useSkillsShowcase());

        act(() => result.current.toggleExpanded('RSI'));
        act(() => result.current.toggleShowAll());

        expect(result.current.expandedKey).toBeNull();
    });
});
