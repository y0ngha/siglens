import { SIGNAL_HUB_MIN_INDEXABLE_ROWS } from '@/entities/signal-history/lib/signalHubs';
import { SITE_URL } from '@/shared/lib/seo';
import { buildSignalHubSitemapEntries } from '../buildSignalHubSitemapEntries';

describe('buildSignalHubSitemapEntries', () => {
    it('색인 기준 이상인 신호 페이지만 싣고 lastmod는 가장 최근 마지막 포착 세션이다', () => {
        const entries = buildSignalHubSitemapEntries([
            {
                signalType: 'golden_cross',
                symbols: SIGNAL_HUB_MIN_INDEXABLE_ROWS,
                latestSession: '2026-11-13',
            },
            {
                signalType: 'death_cross',
                symbols: SIGNAL_HUB_MIN_INDEXABLE_ROWS - 1,
                latestSession: '2026-11-13',
            },
        ]);

        expect(entries).toHaveLength(1);
        expect(entries[0]).toMatchObject({
            url: `${SITE_URL}/market/signals/golden-cross`,
            lastModified: new Date('2026-11-13T00:00:00Z'),
            changeFrequency: 'daily',
        });
    });

    it('허브 목록에 없는 신호의 집계는 무시한다', () => {
        expect(
            buildSignalHubSitemapEntries([
                {
                    signalType: 'cci_bullish_cross',
                    symbols: 99,
                    latestSession: '2026-11-13',
                },
            ])
        ).toEqual([]);
    });

    it('세션 날짜가 깨졌으면 싣지 않는다(잘못된 lastmod를 내지 않는다)', () => {
        expect(
            buildSignalHubSitemapEntries([
                {
                    signalType: 'golden_cross',
                    symbols: 99,
                    latestSession: 'nope',
                },
            ])
        ).toEqual([]);
    });

    it('집계가 비면(조회 실패 포함) 빈 목록이다', () => {
        expect(buildSignalHubSitemapEntries([])).toEqual([]);
    });
});
