import type { WatchlistItemView } from '@/entities/watchlist/model';
import {
    watchlistDisplayName,
    type AssetLabelLookup,
} from '../lib/watchlistDisplayName';

const catalog: Readonly<Record<string, string>> = { AAPL: '애플' };
const assetLabel: AssetLabelLookup = (symbol, fallback) =>
    catalog[symbol] ?? fallback;

function item(symbol: string, companyName: string | null): WatchlistItemView {
    return { symbol, companyName, addedAt: '2026-10-09T00:00:00.000Z' };
}

describe('watchlistDisplayName', () => {
    it('카탈로그 이름이 있으면 저장된 회사명보다 앞선다', () => {
        expect(
            watchlistDisplayName(item('AAPL', 'Apple Inc.'), assetLabel)
        ).toBe('애플');
    });

    it('카탈로그에 없으면 저장된 회사명', () => {
        expect(
            watchlistDisplayName(item('MSFT', 'Microsoft Corp.'), assetLabel)
        ).toBe('Microsoft Corp.');
    });

    it('회사명도 없으면 심볼', () => {
        expect(watchlistDisplayName(item('ZZZQ', null), assetLabel)).toBe(
            'ZZZQ'
        );
    });
});
