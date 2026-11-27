import type { Bar, MarketDataProvider } from '@y0ngha/siglens-core';
import type {
    OpenEpisode,
    SymbolScanWrite,
} from '@/entities/signal-history/types';

const store = vi.hoisted(() => ({
    writes: [] as unknown[],
    sessions: [] as unknown[],
}));
vi.mock('@/entities/signal-history/api', () => ({
    DrizzleSignalHistoryRepository: vi.fn().mockImplementation(function () {
        return {
            loadScanCursors: vi.fn(async () => new Map()),
            latestCompletedSession: vi.fn(async () => null),
            openEpisodesSince: vi.fn(async (): Promise<OpenEpisode[]> => []),
            applySymbolScan: vi.fn(async (write: SymbolScanWrite) => {
                store.writes = [...store.writes, write];
            }),
            recordScanFailure: vi.fn(async () => {}),
            upsertScanSession: vi.fn(async (row: unknown) => {
                store.sessions = [...store.sessions, row];
            }),
            pruneOlderThan: vi.fn(async () => 0),
            pruneScanProgress: vi.fn(async () => ({ sessions: 0, cursors: 0 })),
        };
    }),
    SIGNAL_HISTORY_CACHE_TAG: 'signal-history',
}));
vi.mock('@/shared/config/signalScanUniverse/signalScanUniverse', () => ({
    signalScanTargets: () => [
        { symbol: 'AAA', koreanName: null },
        { symbol: 'BBB', koreanName: null },
    ],
    SIGNAL_SCAN_UNIVERSE_AS_OF: { us: '2026-11-01', kr: '2026-11-01' },
}));
vi.mock('@/entities/ticker/server/koreanNameStore', () => ({
    getKoreanNames: vi.fn(async () => ({})),
}));
vi.mock('@/shared/cache/redisClient', () => ({ getRedisClient: () => null }));

import type { SiglensDatabase } from '@/shared/db/types';
import { addUtcIsoDays } from '@/shared/lib/isoDate';
import { recordSignalHistory } from '../recordSignalHistory';

const NOW = new Date('2026-11-13T21:20:00.000Z');
const SESSION = '2026-11-13';
/**
 * 두 종목의 330봉으로 core 신호 판정 전체를 실제로 돌린다. 로컬에선 1초 안팎이지만 CI 러너(병렬 워커)에선
 * 기본 5초를 넘겨 실패했다. 계산 경로 자체가 검증 대상이라 봉 수를 줄이지 않고 상한만 넉넉히 둔다.
 */
const FULL_SCAN_TIMEOUT_MS = 30_000;

/** 오르내림이 있는 종가 — RSI·MACD·볼린저 신호가 실제로 켜졌다 꺼지게 한다. */
function wavyBars(count: number): Bar[] {
    const dates = Array.from({ length: count * 2 + 10 }, (_, i) =>
        addUtcIsoDays(SESSION, -i)
    )
        .filter(date => {
            const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
            return dow !== 0 && dow !== 6;
        })
        .slice(0, count)
        .toReversed();
    return dates.map((date, i) => {
        const close =
            100 + 18 * Math.sin(i / 9) + 6 * Math.sin(i / 3.1) + i * 0.05;
        return {
            time: Date.parse(`${date}T00:00:00Z`) / 1000,
            open: close - 0.4,
            high: close + 1.2,
            low: close - 1.2,
            close,
            volume: 1_000_000,
        };
    });
}

describe('recordSignalHistory — 실제 판정·계획으로 처음부터 끝까지', () => {
    it(
        '봉에서 신호를 판정해 종목마다 한 번에 쓰고, 세션을 완료로 찍는다',
        { timeout: FULL_SCAN_TIMEOUT_MS },
        async () => {
            vi.spyOn(console, 'log').mockImplementation(() => {});
            const bars = wavyBars(330);
            const provider: MarketDataProvider = {
                getBars: vi.fn(async () => bars),
                getQuote: vi.fn(async () => null),
            };

            const result = await recordSignalHistory({} as SiglensDatabase, {
                now: NOW,
                markers: null,
                invalidate: () => {},
                providerFor: () => ({ provider, upstreamCalls: () => 0 }),
            });

            expect(result).toMatchObject({
                status: 'done',
                us: {
                    status: 'ran',
                    summary: { recorded: 2, completed: true },
                },
            });
            const writes = store.writes as SymbolScanWrite[];
            expect(writes.map(w => w.symbol).toSorted()).toEqual([
                'AAA',
                'BBB',
            ]);
            expect(writes.every(w => w.session === SESSION)).toBe(true);
            const inserts = writes.flatMap(w => w.inserts);
            expect(inserts.length).toBeGreaterThan(10);
            expect(
                inserts.every(
                    row =>
                        row.lastSeenSession >= row.sessionDate &&
                        row.lastSeenSession <= SESSION &&
                        row.computedAt === NOW.toISOString()
                )
            ).toBe(true);
            expect(store.sessions).toEqual([
                expect.objectContaining({
                    market: 'us',
                    sessionDate: SESSION,
                    universeSize: 2,
                    recorded: 2,
                    completedAt: expect.any(String),
                }),
            ]);
        }
    );
});
