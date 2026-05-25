import { buildTabId, buildPanelId } from '@/shared/ui/tabs/utils/tabIds';

describe('tabIds', () => {
    describe('buildTabId', () => {
        it('builds a tab id from prefix and value', () => {
            expect(buildTabId('nav', 'chart')).toBe('nav-tab-chart');
        });

        it('handles empty prefix', () => {
            expect(buildTabId('', 'chart')).toBe('-tab-chart');
        });

        it('handles special characters in value', () => {
            expect(buildTabId('pf', 'tab-1')).toBe('pf-tab-tab-1');
        });
    });

    describe('buildPanelId', () => {
        it('builds a panel id from prefix and value', () => {
            expect(buildPanelId('nav', 'chart')).toBe('nav-panel-chart');
        });

        it('handles empty prefix', () => {
            expect(buildPanelId('', 'chart')).toBe('-panel-chart');
        });

        it('handles special characters in value', () => {
            expect(buildPanelId('pf', 'tab-1')).toBe('pf-panel-tab-1');
        });
    });

    it('tab and panel ids share the same prefix', () => {
        const prefix = 'shared';
        const value = 'overview';
        const tabId = buildTabId(prefix, value);
        const panelId = buildPanelId(prefix, value);
        expect(tabId).toContain(prefix);
        expect(panelId).toContain(prefix);
        expect(tabId).not.toBe(panelId);
    });
});
