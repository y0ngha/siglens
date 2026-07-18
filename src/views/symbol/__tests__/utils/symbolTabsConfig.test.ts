import { TABS } from '@/views/symbol/utils/symbolTabsConfig';

describe('TABS (symbolTabsConfig)', () => {
    it('contains all 9 analysis tabs', () => {
        expect(TABS).toHaveLength(9);
    });

    it('has unique keys', () => {
        const keys = TABS.map(t => t.key);
        expect(new Set(keys).size).toBe(keys.length);
    });

    it('chart tab href is /{symbol}', () => {
        const chart = TABS.find(t => t.key === 'chart')!;
        expect(chart.hrefBuilder('AAPL')).toBe('/AAPL');
    });

    it('news tab href is /{symbol}/news', () => {
        const news = TABS.find(t => t.key === 'news')!;
        expect(news.hrefBuilder('TSLA')).toBe('/TSLA/news');
    });

    it('fundamental tab href is /{symbol}/fundamental', () => {
        const tab = TABS.find(t => t.key === 'fundamental')!;
        expect(tab.hrefBuilder('MSFT')).toBe('/MSFT/fundamental');
    });

    it('options tab href is /{symbol}/options', () => {
        const tab = TABS.find(t => t.key === 'options')!;
        expect(tab.hrefBuilder('NVDA')).toBe('/NVDA/options');
    });

    it('fear-greed tab href is /{symbol}/fear-greed', () => {
        const tab = TABS.find(t => t.key === 'fear-greed')!;
        expect(tab.hrefBuilder('SPY')).toBe('/SPY/fear-greed');
    });

    it('overall tab href is /{symbol}/overall', () => {
        const tab = TABS.find(t => t.key === 'overall')!;
        expect(tab.hrefBuilder('QQQ')).toBe('/QQQ/overall');
    });

    it('financials tab exists with correct href', () => {
        const tab = TABS.find(t => t.key === 'financials')!;
        expect(tab).toBeDefined();
        expect(tab.label).toBe('재무제표');
        expect(tab.hrefBuilder('AAPL')).toBe('/AAPL/financials');
    });

    it('financials tab is positioned after fundamental tab', () => {
        const fundamentalIdx = TABS.findIndex(t => t.key === 'fundamental');
        const financialsIdx = TABS.findIndex(t => t.key === 'financials');
        expect(financialsIdx).toBe(fundamentalIdx + 1);
    });

    it('congress tab exists with correct href', () => {
        const tab = TABS.find(t => t.key === 'congress')!;
        expect(tab).toBeDefined();
        expect(tab.label).toBe('의회 거래');
        expect(tab.hrefBuilder('AAPL')).toBe('/AAPL/congress');
    });

    it('congress tab is positioned after financials tab', () => {
        const financialsIdx = TABS.findIndex(t => t.key === 'financials');
        const congressIdx = TABS.findIndex(t => t.key === 'congress');
        expect(congressIdx).toBe(financialsIdx + 1);
    });

    it('every tab has a non-empty label', () => {
        for (const tab of TABS) {
            expect(tab.label.length).toBeGreaterThan(0);
        }
    });

    it('position tab href is /{symbol}/position', () => {
        const tab = TABS.find(t => t.key === 'position')!;
        expect(tab).toBeDefined();
        expect(tab.label).toBe('내 위치');
        expect(tab.hrefBuilder('AAPL')).toBe('/AAPL/position');
    });

    it('position tab is positioned after overall tab (last)', () => {
        const overallIdx = TABS.findIndex(t => t.key === 'overall');
        const positionIdx = TABS.findIndex(t => t.key === 'position');
        expect(positionIdx).toBe(overallIdx + 1);
        expect(positionIdx).toBe(TABS.length - 1);
    });
});
