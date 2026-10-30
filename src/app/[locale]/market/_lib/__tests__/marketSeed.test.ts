import { describe, expect, it } from 'vitest';
import { buildMarketDehydratedSeed } from '@/app/[locale]/market/_lib/marketSeed';
import { US_DASHBOARD_SCOPE } from '@/shared/config/dashboardScope';

describe('buildMarketDehydratedSeed', () => {
    const state = buildMarketDehydratedSeed(
        US_DASHBOARD_SCOPE,
        { indices: [], sectors: [] },
        { computedAt: '2026-06-04T14', stocks: [] },
        '2026-06-04T14'
    );

    it('두 쿼리를 dateHour 버킷 시작 시각으로 시드한다', () => {
        expect(state.queries.map(query => query.state.dataUpdatedAt)).toEqual([
            Date.UTC(2026, 5, 4, 14),
            Date.UTC(2026, 5, 4, 14),
        ]);
    });

    it('시장 요약과 섹터 신호 쿼리 키를 scope로 잡는다', () => {
        expect(state.queries.map(query => query.queryKey)).toEqual([
            ['market-summary', 'us'],
            ['sector-signals', 'us', '1Day'],
        ]);
    });
});
