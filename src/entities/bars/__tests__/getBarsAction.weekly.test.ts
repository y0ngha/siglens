/**
 * 주봉(`1Week`) 경로 — 실제 core `fetchBarsWithIndicators`로 끝까지 돈다.
 *
 * 제공처는 주봉을 모른다(core가 일봉에서 집계한다). 그래서 `getBarsAction('1Week')`이 제공처에 거는
 * 호출은 `timeframe: '1Day'`뿐이어야 하고(제공처에 `1Week`를 물으면 FMP는 인트라데이 URL을 만들고
 * yahoo는 빈 배열을 돌려준다), 파생 봉 메모리 캐시 키는 `bars:<SYM>:1Week`로 일봉과 갈라진다.
 * 주봉 버킷이 일봉의 UTC 자정 시각에 의존하므로 결과의 주 시작도 월요일 자정이어야 한다.
 * (제공처 계층의 Redis 일봉 히스토리 공유는 이 테스트의 대상이 아니다 — 제공처는 가짜다.)
 */
const { mockTier } = vi.hoisted(() => ({ mockTier: vi.fn() }));

vi.mock('server-only', () => ({}));

vi.mock('@/entities/auth/server/resolveCallerTier', () => ({
    resolveCallerTier: mockTier,
}));
vi.mock('@/entities/ticker/lib/resolveMarketProfile', () => ({
    resolveMarketProfile: vi.fn().mockResolvedValue('us-equity'),
}));
vi.mock('@/entities/ticker/lib/resolveMarketProfileStatic', () => ({
    resolveMarketProfileStatic: vi.fn().mockResolvedValue('us-equity'),
}));
vi.mock('@/shared/api/market/getCachedMarketDataProvider', () => ({
    getCachedMarketDataProvider: vi.fn(() => mockProvider),
}));

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Bar, MarketDataProvider } from '@y0ngha/siglens-core';
import { getBarsAction } from '../actions/getBarsAction';
import { __resetBarsMemoryForTests } from '../server/barsDataCache';

const SECONDS_PER_DAY = 86_400;

/** 2026-06-01(월)부터 평일 `count`개 — UTC 자정 일봉(FMP·yahoo 일봉 규약). */
function weekdayBars(count: number): Bar[] {
    const bars: Bar[] = [];
    let day = Date.UTC(2026, 5, 1) / 1000;
    while (bars.length < count) {
        const weekday = new Date(day * 1000).getUTCDay();
        if (weekday !== 0 && weekday !== 6) {
            const close = 100 + bars.length;
            bars.push({
                time: day,
                open: close - 1,
                high: close + 2,
                low: close - 2,
                close,
                volume: 1_000 + bars.length,
            });
        }
        day += SECONDS_PER_DAY;
    }
    return bars;
}

const getBars = vi.fn<MarketDataProvider['getBars']>();
const mockProvider: MarketDataProvider = {
    getBars,
    getQuote: vi.fn().mockResolvedValue(null),
};

describe('getBarsAction — 1Week', () => {
    beforeEach(() => {
        getBars.mockReset();
        __resetBarsMemoryForTests();
        mockTier.mockResolvedValue('member');
        getBars.mockResolvedValue(weekdayBars(15));
    });

    it('제공처에는 일봉(1Day)으로만 묻는다 — 주봉은 core가 집계한다', async () => {
        await getBarsAction('AAPL', '1Week');

        expect(getBars).toHaveBeenCalledTimes(1);
        expect(
            getBars.mock.calls.map(([options]) => options.timeframe)
        ).toEqual(['1Day']);
    });

    it('주 시작(월요일 UTC 자정)으로 묶인 봉과 그 봉의 지표를 돌려주고 5년 일봉은 떼어 낸다', async () => {
        const data = await getBarsAction('AAPL', '1Week');

        // 15개 평일 = 3개 ISO 주(6/1, 6/8, 6/15).
        expect(data.bars).toHaveLength(3);
        for (const bar of data.bars) {
            expect(bar.time % SECONDS_PER_DAY).toBe(0);
            expect(new Date(bar.time * 1000).getUTCDay()).toBe(1);
        }
        expect(data.bars[0]).toMatchObject({
            time: Date.UTC(2026, 5, 1) / 1000,
            open: 99,
            high: 106,
            low: 98,
            close: 104,
            volume: 1_000 + 1_001 + 1_002 + 1_003 + 1_004,
        });
        expect(data.indicators.rsi).toHaveLength(data.bars.length);
        // 서버 전용 필드(직렬화 경계에서 제거).
        expect(data).not.toHaveProperty('fearGreedBars');
    });

    it('같은 봉 캐시 키(bars:AAPL:1Week)는 메모리에서 재사용돼 제공처를 다시 부르지 않는다', async () => {
        await getBarsAction('AAPL', '1Week');
        await getBarsAction('AAPL', '1Week');

        expect(getBars).toHaveBeenCalledTimes(1);
    });

    it('일봉 캐시와 키가 갈린다 — 일봉 조회는 주봉 엔트리를 재사용하지 않는다', async () => {
        await getBarsAction('AAPL', '1Week');
        const daily = await getBarsAction('AAPL', '1Day');

        expect(getBars).toHaveBeenCalledTimes(2);
        expect(daily.bars).toHaveLength(15);
    });

    it('free 등급은 제공처를 부르기 전에 거절한다', async () => {
        mockTier.mockResolvedValue('free');

        await expect(getBarsAction('AAPL', '1Week')).rejects.toThrow(
            'Timeframe 1Week is not available for free tier.'
        );
        expect(getBars).not.toHaveBeenCalled();
    });
});
