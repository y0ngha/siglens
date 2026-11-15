vi.mock('@/entities/ticker/lib/searchRelevance', () => ({
    isPopularSymbol: (symbol: string) => symbol === 'AAPL',
}));

import type { SignalEpisodeRow } from '@/entities/signal-history/types';
import { buildSignalHubItemListJsonLd } from '../signalHubItemListJsonLd';
import { signalHubRowLabel } from '../signalHubRowLabel';

function row(
    market: SignalEpisodeRow['market'],
    symbol: string,
    koreanName: string | null
): SignalEpisodeRow {
    return {
        market,
        symbol,
        koreanName,
        sessionDate: '2026-11-13',
        lastSeenSession: '2026-11-13',
        changePercent: 1,
    };
}

describe('buildSignalHubItemListJsonLd', () => {
    it('받은 순서대로 position을 매기고, 인기 종목만 URL을 싣는다', () => {
        const data = buildSignalHubItemListJsonLd(
            '골든크로스 종목',
            [row('us', 'AAPL', '애플'), row('kr', '005930.KS', '삼성전자')],
            'ko'
        );

        expect(data).toMatchObject({
            '@type': 'ItemList',
            name: '골든크로스 종목',
            itemListElement: [
                {
                    position: 1,
                    name: '애플 (AAPL)',
                    url: expect.stringContaining('/AAPL'),
                },
                { position: 2, name: '삼성전자 (005930.KS)' },
            ],
        });
        const second = (data.itemListElement as Record<string, unknown>[])[1];
        expect(second).not.toHaveProperty('url');
    });
});

describe('signalHubRowLabel', () => {
    it('한글 이름은 ko에서만, 다른 로케일은 접미사를 뗀 티커', () => {
        const samsung = row('kr', '005930.KS', '삼성전자');

        expect(signalHubRowLabel(samsung, 'ko')).toBe('삼성전자');
        expect(signalHubRowLabel(samsung, 'en')).toBe('005930');
        expect(signalHubRowLabel(row('us', 'NVDA', null), 'ko')).toBe('NVDA');
    });
});
