// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { useIndicatorDropdown } from '../../hooks/useIndicatorDropdown';

vi.mock('@/shared/hooks/useOnClickOutside', () => ({
    useOnClickOutside: vi.fn(),
}));

describe('useIndicatorDropdown', () => {
    it('returns isExpanded false initially', () => {
        const { result } = renderHook(() => useIndicatorDropdown());

        expect(result.current.isExpanded).toBe(false);
    });

    it('returns openDropdown null initially', () => {
        const { result } = renderHook(() => useIndicatorDropdown());

        expect(result.current.openDropdown).toBeNull();
    });

    it('returns dropdownPosition null initially', () => {
        const { result } = renderHook(() => useIndicatorDropdown());

        expect(result.current.dropdownPosition).toBeNull();
    });

    it('provides toolbarRef, portalRef, and buttonRefs', () => {
        const { result } = renderHook(() => useIndicatorDropdown());

        expect(result.current.toolbarRef).toBeDefined();
        expect(result.current.portalRef).toBeDefined();
        expect(result.current.buttonRefs.ma).toBeDefined();
        expect(result.current.buttonRefs.ema).toBeDefined();
    });

    it('toggles expanded state', () => {
        const { result } = renderHook(() => useIndicatorDropdown());

        act(() => {
            result.current.toggleExpanded();
        });
        expect(result.current.isExpanded).toBe(true);

        act(() => {
            result.current.toggleExpanded();
        });
        expect(result.current.isExpanded).toBe(false);
    });

    it('closes open dropdown when toggling expanded', () => {
        const { result } = renderHook(() => useIndicatorDropdown());

        act(() => {
            result.current.toggleExpanded();
        });

        // Simulate that a button rect exists by mocking getBoundingClientRect
        const button = document.createElement('button');
        button.getBoundingClientRect = vi.fn(() => ({
            top: 100,
            left: 200,
            bottom: 120,
            right: 280,
            width: 80,
            height: 20,
            x: 200,
            y: 100,
            toJSON: vi.fn(),
        }));
        Object.defineProperty(result.current.buttonRefs.ma, 'current', {
            value: button,
            writable: true,
        });

        act(() => {
            result.current.toggleDropdown('ma');
        });

        act(() => {
            result.current.toggleExpanded();
        });

        expect(result.current.openDropdown).toBeNull();
    });

    it('returns stable buttonRefs across re-renders', () => {
        const { result, rerender } = renderHook(() => useIndicatorDropdown());

        const firstRefs = result.current.buttonRefs;
        rerender();
        expect(result.current.buttonRefs).toBe(firstRefs);
    });
});
