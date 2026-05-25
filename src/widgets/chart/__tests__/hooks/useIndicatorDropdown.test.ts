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

    it('toggleDropdown closes dropdown when toggling same type', () => {
        const { result } = renderHook(() => useIndicatorDropdown());

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
        expect(result.current.openDropdown).toBe('ma');

        act(() => {
            result.current.toggleDropdown('ma');
        });
        expect(result.current.openDropdown).toBeNull();
    });

    it('toggleDropdown does nothing when button ref is null', () => {
        const { result } = renderHook(() => useIndicatorDropdown());

        // buttonRefs.ma.current is null by default
        act(() => {
            result.current.toggleDropdown('ma');
        });
        expect(result.current.openDropdown).toBeNull();
    });

    it('toggleDropdown switches from one type to another', () => {
        const { result } = renderHook(() => useIndicatorDropdown());

        const maButton = document.createElement('button');
        maButton.getBoundingClientRect = vi.fn(() => ({
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
        const emaButton = document.createElement('button');
        emaButton.getBoundingClientRect = vi.fn(() => ({
            top: 100,
            left: 300,
            bottom: 120,
            right: 380,
            width: 80,
            height: 20,
            x: 300,
            y: 100,
            toJSON: vi.fn(),
        }));
        Object.defineProperty(result.current.buttonRefs.ma, 'current', {
            value: maButton,
            writable: true,
        });
        Object.defineProperty(result.current.buttonRefs.ema, 'current', {
            value: emaButton,
            writable: true,
        });

        act(() => {
            result.current.toggleDropdown('ma');
        });
        expect(result.current.openDropdown).toBe('ma');

        act(() => {
            result.current.toggleDropdown('ema');
        });
        expect(result.current.openDropdown).toBe('ema');
        expect(result.current.dropdownPosition).toEqual({
            top: 120 + 4,
            left: 300,
        });
    });

    it('toggleDropdown sets correct position from button rect', () => {
        const { result } = renderHook(() => useIndicatorDropdown());

        const button = document.createElement('button');
        button.getBoundingClientRect = vi.fn(() => ({
            top: 50,
            left: 150,
            bottom: 70,
            right: 230,
            width: 80,
            height: 20,
            x: 150,
            y: 50,
            toJSON: vi.fn(),
        }));
        Object.defineProperty(result.current.buttonRefs.ma, 'current', {
            value: button,
            writable: true,
        });

        act(() => {
            result.current.toggleDropdown('ma');
        });
        expect(result.current.dropdownPosition).toEqual({
            top: 70 + 4, // bottom + DROPDOWN_OFFSET_PX
            left: 150,
        });
    });
});
