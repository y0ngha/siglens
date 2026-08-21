import koMessages from '@/../messages/ko.json';
import enMessages from '@/../messages/en.json';
import jaMessages from '@/../messages/ja.json';
import zhMessages from '@/../messages/zh.json';

const CATALOGS = {
    ko: koMessages,
    en: enMessages,
    ja: jaMessages,
    zh: zhMessages,
};

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
        expect(tab.labelKey).toBe('financials');
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
        expect(tab.labelKey).toBe('congress');
        expect(tab.hrefBuilder('AAPL')).toBe('/AAPL/congress');
    });

    it('congress tab is positioned after financials tab', () => {
        const financialsIdx = TABS.findIndex(t => t.key === 'financials');
        const congressIdx = TABS.findIndex(t => t.key === 'congress');
        expect(congressIdx).toBe(financialsIdx + 1);
    });

    /**
     * 라벨이 비었는지가 아니라 **네 로케일 카탈로그에 다 있는지**를 본다.
     * 새 탭을 추가하고 번역을 빠뜨리면 여기서 실패한다 — 예전 단언(길이 > 0)은
     * 한국어 상수가 박혀 있는 한 언제나 통과했다.
     */
    it('모든 탭 라벨 키가 네 로케일에 다 있다', () => {
        for (const tab of TABS) {
            for (const [locale, catalog] of Object.entries(CATALOGS)) {
                expect(
                    catalog.shared.symbolTab[tab.labelKey],
                    `${locale}: ${tab.labelKey}`
                ).toBeTruthy();
            }
        }
    });

    it('position tab href is /{symbol}/position', () => {
        const tab = TABS.find(t => t.key === 'position')!;
        expect(tab).toBeDefined();
        expect(tab.labelKey).toBe('position');
        expect(tab.hrefBuilder('AAPL')).toBe('/AAPL/position');
    });

    it('position tab is positioned after overall tab (last)', () => {
        const overallIdx = TABS.findIndex(t => t.key === 'overall');
        const positionIdx = TABS.findIndex(t => t.key === 'position');
        expect(positionIdx).toBe(overallIdx + 1);
        expect(positionIdx).toBe(TABS.length - 1);
    });
});
