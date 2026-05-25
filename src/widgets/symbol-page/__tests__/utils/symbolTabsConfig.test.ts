import { TABS } from '@/widgets/symbol-page/utils/symbolTabsConfig';

describe('TABS (symbolTabsConfig)', () => {
    it('contains all 6 analysis tabs', () => {
        expect(TABS).toHaveLength(6);
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

    it('every tab has a non-empty label', () => {
        for (const tab of TABS) {
            expect(tab.label.length).toBeGreaterThan(0);
        }
    });
});
