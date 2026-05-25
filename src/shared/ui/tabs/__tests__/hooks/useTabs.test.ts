// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { useTabs } from '@/shared/ui/tabs/hooks/useTabs';

describe('useTabs', () => {
    const tabs = ['tab1', 'tab2', 'tab3'] as const;
    const onChange = vi.fn();

    beforeEach(() => {
        onChange.mockClear();
    });

    it('returns getTabProps and getPanelProps functions', () => {
        const { result } = renderHook(() =>
            useTabs({ tabs, activeTab: 'tab1', onChange, idPrefix: 'test' })
        );
        expect(typeof result.current.getTabProps).toBe('function');
        expect(typeof result.current.getPanelProps).toBe('function');
    });

    describe('getTabProps', () => {
        it('returns role="tab"', () => {
            const { result } = renderHook(() =>
                useTabs({ tabs, activeTab: 'tab1', onChange, idPrefix: 'test' })
            );
            expect(result.current.getTabProps('tab1').role).toBe('tab');
        });

        it('sets aria-selected=true for active tab', () => {
            const { result } = renderHook(() =>
                useTabs({ tabs, activeTab: 'tab1', onChange, idPrefix: 'test' })
            );
            expect(result.current.getTabProps('tab1')['aria-selected']).toBe(
                true
            );
            expect(result.current.getTabProps('tab2')['aria-selected']).toBe(
                false
            );
        });

        it('sets tabIndex=0 for active tab and -1 for others', () => {
            const { result } = renderHook(() =>
                useTabs({ tabs, activeTab: 'tab2', onChange, idPrefix: 'test' })
            );
            expect(result.current.getTabProps('tab2').tabIndex).toBe(0);
            expect(result.current.getTabProps('tab1').tabIndex).toBe(-1);
        });

        it('generates correct id and aria-controls', () => {
            const { result } = renderHook(() =>
                useTabs({ tabs, activeTab: 'tab1', onChange, idPrefix: 'pf' })
            );
            const props = result.current.getTabProps('tab1');
            expect(props.id).toBe('pf-tab-tab1');
            expect(props['aria-controls']).toBe('pf-panel-tab1');
        });

        it('calls onChange on click', () => {
            const { result } = renderHook(() =>
                useTabs({ tabs, activeTab: 'tab1', onChange, idPrefix: 'test' })
            );
            result.current.getTabProps('tab2').onClick();
            expect(onChange).toHaveBeenCalledWith('tab2');
        });
    });

    describe('getPanelProps', () => {
        it('returns role="tabpanel"', () => {
            const { result } = renderHook(() =>
                useTabs({ tabs, activeTab: 'tab1', onChange, idPrefix: 'test' })
            );
            expect(result.current.getPanelProps('tab1').role).toBe('tabpanel');
        });

        it('sets hidden=false for active tab panel', () => {
            const { result } = renderHook(() =>
                useTabs({ tabs, activeTab: 'tab1', onChange, idPrefix: 'test' })
            );
            expect(result.current.getPanelProps('tab1').hidden).toBe(false);
            expect(result.current.getPanelProps('tab2').hidden).toBe(true);
        });

        it('sets correct id and aria-labelledby', () => {
            const { result } = renderHook(() =>
                useTabs({ tabs, activeTab: 'tab1', onChange, idPrefix: 'pf' })
            );
            const props = result.current.getPanelProps('tab1');
            expect(props.id).toBe('pf-panel-tab1');
            expect(props['aria-labelledby']).toBe('pf-tab-tab1');
        });
    });
});
