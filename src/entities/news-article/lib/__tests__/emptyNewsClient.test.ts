import { describe, it, expect } from 'vitest';
import { EMPTY_NEWS_CLIENT } from '../emptyNewsClient';

/**
 * `EMPTY_NEWS_CLIENT`는 "소스가 없으면 빈 결과" 계약을 검증한다 — KR 종목이 잘못된
 * 소스(FMP `stock`)로 폴백해 무관한 미국 뉴스를 보여주는 사고를 막는 방어선.
 */
describe('EMPTY_NEWS_CLIENT', () => {
    it('fetchNews resolves to an empty array regardless of input', async () => {
        await expect(
            EMPTY_NEWS_CLIENT.fetchNews('005930.KS', '24h')
        ).resolves.toEqual([]);
        await expect(EMPTY_NEWS_CLIENT.fetchNews('', '30d')).resolves.toEqual(
            []
        );
    });

    it('fetchNewsForPeriod resolves to an empty array regardless of lookback', async () => {
        await expect(
            EMPTY_NEWS_CLIENT.fetchNewsForPeriod('005930.KS', 86_400_000)
        ).resolves.toEqual([]);
        await expect(
            EMPTY_NEWS_CLIENT.fetchNewsForPeriod('005930.KS', 0)
        ).resolves.toEqual([]);
    });

    it('fetchEarningsReport resolves to null (no earnings source configured)', async () => {
        await expect(
            EMPTY_NEWS_CLIENT.fetchEarningsReport('005930.KS')
        ).resolves.toBeNull();
    });
});
