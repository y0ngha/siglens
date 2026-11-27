import type { Bar } from '@y0ngha/siglens-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getAssetInfo, getBars } = vi.hoisted(() => ({
    getAssetInfo: vi.fn(),
    getBars: vi.fn(),
}));

vi.mock('@/entities/ticker/server/getAssetInfo', () => ({ getAssetInfo }));
vi.mock('@/entities/bars/server/barsDataCache', () => ({
    getCachedBarsWithIndicators: getBars,
}));
vi.mock('@/shared/api/market/getCachedMarketDataProvider', () => ({
    getCachedMarketDataProvider: () => ({}),
}));

import { CONVERSATION_CHANGES_MAX_SYMBOLS } from '@/entities/chat-conversation/server/conversationAnalyses';
import {
    CONVERSATION_CHANGES_TIMEOUT_MS,
    loadConversationChanges,
} from '@/entities/chat-conversation/server/loadConversationChanges';
import { SECONDS_PER_DAY } from '@/shared/config/time';

type Row = Parameters<typeof loadConversationChanges>[0][number];

// 일봉은 거래일의 UTC 자정에 찍힌다. 주말 구분 없이 하루씩 센 합성 시리즈다.
const START = Date.UTC(2026, 0, 1) / 1000;

function bars(closes: readonly number[]): {
    bars: Bar[];
    indicators: object;
} {
    return {
        indicators: {},
        bars: closes.map((close, i) => ({
            time: START + i * SECONDS_PER_DAY,
            open: close,
            high: close + 1,
            low: close - 1,
            close,
            volume: 1_000,
        })),
    };
}

const flat = (len: number): number[] => Array.from({ length: len }, () => 100);
const analyzedAt = new Date(
    (START + 59 * SECONDS_PER_DAY + 12 * 3600) * 1000
).toISOString();

const SUPPORT = {
    keyLevels: {
        support: [{ price: 95, strength: 'strong', reason: 's' }],
        resistance: [],
    },
};

function rowsFor(symbols: readonly string[]): Row[] {
    return symbols.flatMap((symbol, i): Row[] => [
        {
            seq: i * 2 + 1,
            role: 'assistant',
            content: '',
            toolCalls: [
                {
                    id: `c-${symbol}`,
                    name: 'get_cached_analysis',
                    args: { symbol },
                },
            ],
            toolCallId: null,
            toolName: null,
            status: 'complete',
        },
        {
            seq: i * 2 + 2,
            role: 'tool',
            content: JSON.stringify({
                found: true,
                tab: 'technical',
                timeframe: '1Day',
                generatedAt: analyzedAt,
                analysis: SUPPORT,
            }),
            toolCalls: null,
            toolCallId: `c-${symbol}`,
            toolName: 'get_cached_analysis',
            status: 'complete',
        },
    ]);
}

describe('loadConversationChanges', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, 'error').mockImplementation(() => {});
        // 마지막 봉(2026-03-04 부근)이 이미 끝난 세션이 되도록 시계를 한참 뒤로 둔다.
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-06-01T00:00:00Z'));
        getAssetInfo.mockResolvedValue({
            symbol: 'NVDA',
            name: 'NVIDIA',
            fmpSymbol: 'NVDA',
        });
        getBars.mockResolvedValue(bars([...flat(60), 94]));
    });
    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('분석이 있는 종목마다 달라진 점을 계산해 돌려준다', async () => {
        const results = await loadConversationChanges(rowsFor(['NVDA']));
        expect(results).toHaveLength(1);
        expect(results[0]).toMatchObject({
            symbol: 'NVDA',
            status: 'changes',
            closeNow: 94,
            marketProfile: 'us-equity',
        });
        // 같은 일봉 시리즈(에이전트가 읽는 것)를 쓰고, 일봉으로만 읽는다.
        expect(getBars).toHaveBeenCalledWith(
            expect.anything(),
            'NVDA',
            '1Day',
            'NVDA',
            expect.anything()
        );
    });

    it('카드는 최근에 본 종목부터 상한까지만 계산한다', async () => {
        const symbols = ['A', 'B', 'C', 'D', 'E'];
        const results = await loadConversationChanges(rowsFor(symbols));
        expect(results.map(r => r.symbol)).toEqual(
            symbols.toReversed().slice(0, CONVERSATION_CHANGES_MAX_SYMBOLS)
        );
        const loaded = getBars.mock.calls.map(call => call[1]);
        expect(loaded.toSorted()).toEqual(['C', 'D', 'E']);
    });

    it('한 종목이 실패해도 나머지 종목은 돌려준다', async () => {
        getBars.mockImplementation(
            async (_provider: unknown, symbol: string) => {
                if (symbol === 'AAPL') throw new Error('fmp 429');
                return bars([...flat(60), 94]);
            }
        );
        const results = await loadConversationChanges(
            rowsFor(['NVDA', 'AAPL'])
        );
        expect(results.map(r => r.symbol)).toEqual(['NVDA']);
    });

    it('시간 상한을 넘긴 종목만 빠지고 다른 종목은 영향이 없다', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-06-01T00:00:00Z'));
        getBars.mockImplementation((_provider: unknown, symbol: string) =>
            symbol === 'AAPL'
                ? new Promise(() => {})
                : Promise.resolve(bars([...flat(60), 94]))
        );
        const pending = loadConversationChanges(rowsFor(['NVDA', 'AAPL']));
        await vi.advanceTimersByTimeAsync(CONVERSATION_CHANGES_TIMEOUT_MS + 1);
        expect((await pending).map(r => r.symbol)).toEqual(['NVDA']);
    });

    it('종목 정보를 못 읽으면 그 종목만 빠진다', async () => {
        getAssetInfo.mockRejectedValue(new Error('db'));
        expect(await loadConversationChanges(rowsFor(['NVDA']))).toEqual([]);
    });

    it('받은 일봉 밖으로 오래된 분석은 too_old로 돌려준다', async () => {
        getBars.mockResolvedValue(bars(flat(300)));
        const rows = rowsFor(['NVDA']);
        rows[1] = {
            ...rows[1],
            content: JSON.stringify({
                found: true,
                tab: 'technical',
                timeframe: '1Day',
                generatedAt: new Date(START * 1000).toISOString(),
                analysis: SUPPORT,
            }),
        };
        const [result] = await loadConversationChanges(rows);
        expect(result.status).toBe('too_old');
    });

    it('대화에 분석이 없으면 아무것도 읽지 않는다', async () => {
        expect(await loadConversationChanges([])).toEqual([]);
        expect(getAssetInfo).not.toHaveBeenCalled();
        expect(getBars).not.toHaveBeenCalled();
    });

    it('정규장 중 마지막 봉(형성 중)은 떼고 완결된 일봉만 비교한다', async () => {
        // 2026-03-02(월) 장중(ET 11:00)에 마지막 봉이 그날 봉이다.
        const monday = Date.UTC(2026, 2, 2) / 1000;
        const series = [
            ...Array.from({ length: 60 }, (_, i) => ({
                time: monday - (61 - i) * SECONDS_PER_DAY,
                open: 100,
                high: 101,
                low: 99,
                close: 100,
                volume: 1_000,
            })),
            { time: monday, open: 90, high: 91, low: 89, close: 90, volume: 1 },
        ];
        getBars.mockResolvedValue({ bars: series, indicators: {} });
        vi.setSystemTime(new Date('2026-03-02T16:00:00Z'));
        const rows = rowsFor(['NVDA']);
        rows[1] = {
            ...rows[1],
            content: JSON.stringify({
                found: true,
                tab: 'technical',
                timeframe: '1Day',
                generatedAt: new Date(
                    (monday - 4 * SECONDS_PER_DAY) * 1000
                ).toISOString(),
                analysis: SUPPORT,
            }),
        };
        const [result] = await loadConversationChanges(rows);
        // 형성 중 봉(종가 90)이 남았다면 지지선 95 아래 마감으로 읽혔을 것이다.
        expect(result).toMatchObject({ status: 'changes', items: [] });
        expect(result.status === 'changes' && result.closeNow).toBe(100);
    });
});
