import type { MarketDataProvider } from '@y0ngha/siglens-core';
import type {
    ScanCursor,
    SignalHistoryMarket,
} from '@/entities/signal-history/types';

const repo = vi.hoisted(() => ({
    loadScanCursors: vi.fn(),
    latestCompletedSession: vi.fn(),
    upsertScanSession: vi.fn(),
    pruneOlderThan: vi.fn(),
    pruneScanProgress: vi.fn(),
}));
vi.mock('@/entities/signal-history/api', () => ({
    DrizzleSignalHistoryRepository: vi.fn().mockImplementation(function () {
        return repo;
    }),
    SIGNAL_HISTORY_CACHE_TAG: 'signal-history',
}));

const universe = vi.hoisted(() => ({
    targets: {
        us: [] as { symbol: string; koreanName: string | null }[],
        kr: [] as { symbol: string; koreanName: string | null }[],
    },
    asOf: { us: '2026-11-01', kr: '2026-11-01' },
}));
vi.mock('@/shared/config/signalScanUniverse/signalScanUniverse', () => ({
    signalScanTargets: (market: 'us' | 'kr') => universe.targets[market],
    SIGNAL_SCAN_UNIVERSE_AS_OF: universe.asOf,
}));

const scanSymbolMock = vi.hoisted(() => vi.fn());
vi.mock('../scanSymbol', () => ({ scanSymbol: scanSymbolMock }));
vi.mock('@/entities/ticker/server/koreanNameStore', () => ({
    getKoreanNames: vi.fn(),
}));
vi.mock('@/shared/cache/redisClient', () => ({ getRedisClient: () => null }));

import type { SiglensDatabase } from '@/shared/db/types';
import {
    recordSignalHistory,
    type RecordedMarkerStore,
    type RecordSignalHistoryResult,
} from '../recordSignalHistory';

const DB = {} as SiglensDatabase;
const invalidate = vi.fn();
const koreanNames = vi.fn();
// 2026-11-13(금) 21:20 UTC = 16:20 ET(미국 마감+20분) = 11-14 06:20 KST(한국은 다음 날 새벽 → 건너뜀).
const US_AFTER_CLOSE = new Date('2026-11-13T21:20:00.000Z');
// 같은 날 07:10 UTC = 16:10 KST(한국 마감+40분) = 02:10 ET(미국은 장 열기 전 → 건너뜀).
const KR_AFTER_CLOSE = new Date('2026-11-13T07:10:00.000Z');
const SESSION = '2026-11-13';
const BACKOFF_US = `signal-history:backoff:v2:us:${SESSION}`;

const NO_CURSOR: ScanCursor | undefined = undefined;
const recordedCursor = (lastSession = '2026-11-12'): ScanCursor => ({
    lastSession,
    attemptSession: null,
    attempts: 0,
    lastOutcome: 'recorded',
});
const failedCursor = (attempts: number): ScanCursor => ({
    lastSession: '2026-11-12',
    attemptSession: SESSION,
    attempts,
    lastOutcome: 'failed',
});

function targetsOf(...symbols: string[]) {
    return symbols.map(symbol => ({ symbol, koreanName: null }));
}

function fakeProviders(upstream: { calls: number } = { calls: 0 }) {
    const provider: MarketDataProvider = {
        getBars: vi.fn(async () => []),
        getQuote: vi.fn(async () => null),
    };
    return {
        upstream,
        providerFor: (_market: SignalHistoryMarket) => ({
            provider,
            upstreamCalls: () => upstream.calls,
        }),
    };
}

function memoryMarkers(initial: readonly string[] = []): RecordedMarkerStore & {
    readonly keys: Set<string>;
    readonly mark: ReturnType<typeof vi.fn>;
} {
    const keys = new Set(initial);
    return {
        keys,
        has: async key => keys.has(key),
        mark: vi.fn(async (key: string) => {
            keys.add(key);
        }),
    };
}

type Done = Extract<RecordSignalHistoryResult, { status: 'done' }>;

async function runDone(
    options: Parameters<typeof recordSignalHistory>[1] = {}
): Promise<Done> {
    const result = await recordSignalHistory(DB, {
        now: US_AFTER_CLOSE,
        markers: null,
        invalidate,
        koreanNames,
        ...fakeProviders(),
        ...options,
    });
    if (result.status !== 'done') throw new Error('expected done');
    return result;
}

/** 실행한 시장의 요약을 꺼낸다. */
function summaryOf(outcome: Done['us']) {
    if (outcome.status !== 'ran') throw new Error('expected ran');
    return outcome.summary;
}

const scannedSymbols = (): string[] =>
    scanSymbolMock.mock.calls.map(([, target]) => target.symbol);

beforeEach(() => {
    universe.targets.us = targetsOf('AAA', 'BBB', 'CCC');
    universe.targets.kr = targetsOf('005930.KS', '000660.KS');
    universe.asOf.us = '2026-11-01';
    universe.asOf.kr = '2026-11-01';
    invalidate.mockReset();
    koreanNames.mockReset().mockResolvedValue({});
    repo.loadScanCursors.mockReset().mockResolvedValue(new Map());
    repo.latestCompletedSession.mockReset().mockResolvedValue(null);
    repo.upsertScanSession.mockReset().mockResolvedValue(undefined);
    repo.pruneOlderThan.mockReset().mockResolvedValue(3);
    repo.pruneScanProgress
        .mockReset()
        .mockResolvedValue({ sessions: 1, cursors: 2 });
    scanSymbolMock.mockReset().mockImplementation(async (_ctx, target) => ({
        outcome: 'recorded',
        mode: target.cursor === undefined ? 'bootstrap' : 'normal',
    }));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe('recordSignalHistory — 시점', () => {
    it('미국 마감 뒤에는 미국만 기록하고 한국은 건너뛴다', async () => {
        const result = await runDone();

        expect(result.us).toMatchObject({ status: 'ran' });
        expect(result.kr).toEqual({ status: 'skipped' });
        expect(repo.loadScanCursors).toHaveBeenCalledWith('us', [
            'AAA',
            'BBB',
            'CCC',
        ]);
    });

    it('한국 마감 뒤에는 한국만 기록한다', async () => {
        const result = await runDone({ now: KR_AFTER_CLOSE });

        expect(result.kr).toMatchObject({ status: 'ran' });
        expect(result.us).toEqual({ status: 'skipped' });
        expect(summaryOf(result.kr)).toMatchObject({
            market: 'kr',
            session: SESSION,
            attempted: 2,
        });
    });

    it('장중에는 진행 표식도 읽지 않는다', async () => {
        const result = await runDone({
            now: new Date('2026-11-13T18:00:00.000Z'),
        });

        expect(result.us).toEqual({ status: 'skipped' });
        expect(result.kr).toEqual({ status: 'skipped' });
        expect(repo.loadScanCursors).not.toHaveBeenCalled();
    });
});

describe('recordSignalHistory — 종목 선택', () => {
    it('이번 세션에 이미 기록된 종목은 건너뛰고, 표식이 있는 종목을 처음 기록하는 종목보다 먼저 한다', async () => {
        universe.targets.us = targetsOf('AAA', 'BBB', 'CCC', 'DDD');
        repo.loadScanCursors.mockResolvedValue(
            new Map([
                ['AAA', recordedCursor(SESSION)],
                ['CCC', recordedCursor()],
            ])
        );

        const result = await runDone();

        expect(scannedSymbols()).toEqual(['CCC', 'BBB', 'DDD']);
        expect(summaryOf(result.us)).toMatchObject({
            pending: 3,
            attempted: 3,
            recorded: 3,
            bootstrapped: 2,
        });
    });

    it('시도를 다 쓴 종목은 다시 시도하지 않는다', async () => {
        universe.targets.us = targetsOf('AAA', 'BBB');
        repo.loadScanCursors.mockResolvedValue(
            new Map([
                ['AAA', recordedCursor(SESSION)],
                ['BBB', failedCursor(3)],
            ])
        );

        const result = await runDone();

        expect(scanSymbolMock).not.toHaveBeenCalled();
        expect(summaryOf(result.us)).toMatchObject({
            completed: true,
            settledFailed: 1,
        });
    });

    it('한 번 실패한 종목은 다음 실행에서 다시 시도하고, 이어받은 시도 횟수를 센다', async () => {
        universe.targets.us = targetsOf('AAA');
        repo.loadScanCursors.mockResolvedValue(
            new Map([['AAA', failedCursor(2)]])
        );
        scanSymbolMock.mockResolvedValue({
            outcome: 'stale',
            persisted: true,
        });

        const result = await runDone();

        expect(scannedSymbols()).toEqual(['AAA']);
        expect(summaryOf(result.us)).toMatchObject({
            stale: 1,
            completed: true,
            settledFailed: 1,
        });
    });

    it('시도 기록이 DB에 써지지 않았으면 그 시도로 세션을 완료로 찍지 않는다', async () => {
        universe.targets.us = targetsOf('AAA');
        repo.loadScanCursors.mockResolvedValue(
            new Map([['AAA', failedCursor(2)]])
        );
        scanSymbolMock.mockResolvedValue({
            outcome: 'failed',
            persisted: false,
        });

        const result = await runDone();

        expect(repo.upsertScanSession).toHaveBeenCalledWith(
            expect.objectContaining({ completedAt: null })
        );
        expect(summaryOf(result.us)).toMatchObject({
            failed: 1,
            completed: false,
        });
        expect(invalidate).not.toHaveBeenCalled();
    });

    it('이 세션에 이미 실패한 종목은 맨 뒤로 보낸다(죽은 종목이 앞에 몰려 장애 차단기를 켜지 않게)', async () => {
        universe.targets.us = targetsOf('AAA', 'BBB', 'CCC');
        repo.loadScanCursors.mockResolvedValue(
            new Map([
                ['AAA', failedCursor(1)],
                ['BBB', recordedCursor()],
            ])
        );

        await runDone();

        expect(scannedSymbols()).toEqual(['BBB', 'CCC', 'AAA']);
    });

    it('종목마다 시장·세션을 담은 문맥으로 부른다', async () => {
        await runDone();

        expect(scanSymbolMock).toHaveBeenCalledWith(
            expect.objectContaining({
                market: 'us',
                session: SESSION,
                now: US_AFTER_CLOSE,
            }),
            expect.objectContaining({ symbol: 'AAA', cursor: NO_CURSOR })
        );
    });
});

describe('recordSignalHistory — 완료', () => {
    it('모든 종목이 정리되면 세션을 완료로 찍고, 캐시를 비우고, 정리한다', async () => {
        const result = await runDone();

        expect(repo.upsertScanSession).toHaveBeenCalledWith({
            market: 'us',
            sessionDate: SESSION,
            universeSize: 3,
            recorded: 3,
            failed: 0,
            stale: 0,
            completedAt: expect.any(String),
        });
        expect(invalidate).toHaveBeenCalledTimes(1);
        expect(repo.pruneOlderThan).toHaveBeenCalledWith('2025-10-09');
        expect(repo.pruneScanProgress).toHaveBeenCalledWith('2025-10-09', {
            us: ['AAA', 'BBB', 'CCC'],
            kr: ['005930.KS', '000660.KS'],
        });
        expect(result.us).toMatchObject({
            status: 'ran',
            pruned: { events: 3, progress: { sessions: 1, cursors: 2 } },
        });
    });

    it('일부만 정리된 실행은 완료로 찍지 않고 캐시도 정리도 건드리지 않는다', async () => {
        scanSymbolMock.mockImplementation(async (_ctx, target) =>
            target.symbol === 'BBB'
                ? { outcome: 'failed' }
                : { outcome: 'recorded', mode: 'bootstrap' }
        );

        const result = await runDone();

        expect(repo.upsertScanSession).toHaveBeenCalledWith(
            expect.objectContaining({
                recorded: 2,
                failed: 1,
                completedAt: null,
            })
        );
        expect(invalidate).not.toHaveBeenCalled();
        expect(repo.pruneOlderThan).not.toHaveBeenCalled();
        expect(result.us).toMatchObject({ pruned: null });
        expect(summaryOf(result.us)).toMatchObject({
            completed: false,
            failed: 1,
        });
    });

    it('이미 완료로 찍힌 세션이고 할 일이 없으면 아무것도 하지 않는다', async () => {
        repo.loadScanCursors.mockResolvedValue(
            new Map(
                ['AAA', 'BBB', 'CCC'].map(s => [s, recordedCursor(SESSION)])
            )
        );
        repo.latestCompletedSession.mockResolvedValue(SESSION);

        const result = await runDone();

        expect(result.us).toEqual({ status: 'skipped' });
        expect(repo.upsertScanSession).not.toHaveBeenCalled();
        expect(invalidate).not.toHaveBeenCalled();
    });

    it('전부 정리됐지만 완료 표식이 없으면(표식을 쓰기 전에 멈춤) 종목은 다시 시도하지 않고 완료만 처리한다', async () => {
        repo.loadScanCursors.mockResolvedValue(
            new Map(
                ['AAA', 'BBB', 'CCC'].map(s => [s, recordedCursor(SESSION)])
            )
        );
        repo.latestCompletedSession.mockResolvedValue('2026-11-12');

        const result = await runDone();

        expect(scanSymbolMock).not.toHaveBeenCalled();
        expect(repo.upsertScanSession).toHaveBeenCalledWith(
            expect.objectContaining({
                recorded: 3,
                completedAt: expect.any(String),
            })
        );
        expect(invalidate).toHaveBeenCalledTimes(1);
        expect(summaryOf(result.us)).toMatchObject({
            pending: 0,
            attempted: 0,
            completed: true,
        });
    });

    it('캐시 무효화가 던져도 결과와 정리는 그대로다', async () => {
        invalidate.mockImplementation(() => {
            throw new Error('no request scope');
        });

        const result = await runDone();

        expect(result.us).toMatchObject({
            status: 'ran',
            pruned: { events: 3 },
        });
    });

    it('정리가 던져도 결과를 돌려준다(그 정리 값만 null)', async () => {
        repo.pruneOlderThan.mockRejectedValue(new Error('db'));

        const result = await runDone();

        expect(result.us).toMatchObject({
            status: 'ran',
            pruned: { events: null, progress: { sessions: 1, cursors: 2 } },
        });
    });
});

describe('recordSignalHistory — 예산·장애', () => {
    it('예산이 끝나기 10초 전부터는 새 종목을 시작하지 않는다(남은 종목은 다음 실행)', async () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(US_AFTER_CLOSE);
        universe.targets.us = targetsOf(
            ...Array.from({ length: 12 }, (_, i) => `S${i}`)
        );
        scanSymbolMock.mockImplementation(async () => {
            // 첫 덩어리가 끝날 즈음 예산 끝 10초 전을 넘긴다.
            vi.setSystemTime(US_AFTER_CLOSE.getTime() + 21_000);
            return { outcome: 'recorded', mode: 'normal' };
        });

        const result = await runDone({
            budgetEndMs: US_AFTER_CLOSE.getTime() + 30_000,
        });

        expect(summaryOf(result.us)).toMatchObject({
            pending: 12,
            attempted: 4,
            recorded: 4,
            completed: false,
        });
        expect(repo.upsertScanSession).toHaveBeenCalledWith(
            expect.objectContaining({ recorded: 4, completedAt: null })
        );
        expect(invalidate).not.toHaveBeenCalled();
    });

    it('시도가 20번 미만이면 모두 실패해도 장애로 보지 않는다', async () => {
        universe.targets.us = targetsOf(
            ...Array.from({ length: 8 }, (_, i) => `S${i}`)
        );
        scanSymbolMock.mockResolvedValue({ outcome: 'failed' });
        const markers = memoryMarkers();

        const result = await runDone({ markers });

        expect(summaryOf(result.us)).toMatchObject({
            attempted: 8,
            failed: 8,
        });
        expect(markers.mark).not.toHaveBeenCalled();
    });

    it('20번 시도한 뒤 절반 이상이 실패하면 장애로 보고 멈추고 10분 백오프 표식을 남긴다', async () => {
        universe.targets.us = targetsOf(
            ...Array.from({ length: 40 }, (_, i) => `S${i}`)
        );
        scanSymbolMock.mockResolvedValue({ outcome: 'stale' });
        const markers = memoryMarkers();

        const result = await runDone({ markers });

        expect(summaryOf(result.us)).toMatchObject({
            pending: 40,
            attempted: 20,
            stale: 20,
            completed: false,
        });
        expect(markers.mark).toHaveBeenCalledWith(BACKOFF_US, 600);
        expect(console.error).toHaveBeenCalledWith(
            '[signal-history] provider outage suspected: us'
        );
    });

    it('20번 시도 중 정확히 10번 실패하면 장애로 본다(경계)', async () => {
        universe.targets.us = targetsOf(
            ...Array.from({ length: 40 }, (_, i) => `S${i}`)
        );
        const failing = new Set(Array.from({ length: 10 }, (_, i) => `S${i}`));
        scanSymbolMock.mockImplementation(async (_ctx, target) =>
            failing.has(target.symbol)
                ? { outcome: 'failed', persisted: true }
                : { outcome: 'recorded', mode: 'normal', latestUnknown: false }
        );
        const markers = memoryMarkers();

        const result = await runDone({ markers });

        expect(summaryOf(result.us)).toMatchObject({ attempted: 20 });
        expect(markers.mark).toHaveBeenCalledWith(BACKOFF_US, 600);
    });

    it('20번 시도 중 9번 실패는 장애가 아니다(경계)', async () => {
        universe.targets.us = targetsOf(
            ...Array.from({ length: 40 }, (_, i) => `S${i}`)
        );
        const failing = new Set(Array.from({ length: 9 }, (_, i) => `S${i}`));
        scanSymbolMock.mockImplementation(async (_ctx, target) =>
            failing.has(target.symbol)
                ? { outcome: 'failed', persisted: true }
                : { outcome: 'recorded', mode: 'normal', latestUnknown: false }
        );
        const markers = memoryMarkers();

        const result = await runDone({ markers });

        expect(summaryOf(result.us)).toMatchObject({
            attempted: 40,
            failed: 9,
        });
        expect(markers.mark).not.toHaveBeenCalled();
    });

    it('백오프 표식이 있으면 그 세션은 진행 표식도 읽지 않고 건너뛴다', async () => {
        const result = await runDone({ markers: memoryMarkers([BACKOFF_US]) });

        expect(result.us).toEqual({ status: 'skipped' });
        expect(repo.loadScanCursors).not.toHaveBeenCalled();
    });

    it('표식을 남기다 던져도 이 실행의 진행은 저장된다', async () => {
        universe.targets.us = targetsOf(
            ...Array.from({ length: 40 }, (_, i) => `S${i}`)
        );
        scanSymbolMock.mockResolvedValue({ outcome: 'failed' });
        const markers = memoryMarkers();
        markers.mark.mockRejectedValue(new Error('redis down'));

        const result = await runDone({ markers });

        expect(result.us).toMatchObject({ status: 'ran' });
        expect(repo.upsertScanSession).toHaveBeenCalledTimes(1);
    });

    it('예산 안에 끝나지 않으면(멈춘 프로바이더) 기다리지 않고 timed_out', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(US_AFTER_CLOSE);
        scanSymbolMock.mockImplementation(() => new Promise(() => {}));

        const pending = recordSignalHistory(DB, {
            now: US_AFTER_CLOSE,
            markers: null,
            invalidate,
            koreanNames,
            ...fakeProviders(),
            // 새 종목 시작을 멈추는 선(예산 끝 10초 전)보다 뒤에 있어야 첫 덩어리가 시작된다.
            budgetEndMs: US_AFTER_CLOSE.getTime() + 15_000,
        });
        await vi.advanceTimersByTimeAsync(15_000);

        await expect(pending).resolves.toEqual({ status: 'timed_out' });
    });

    it('남은 예산이 없으면 시작하지 않는다', async () => {
        const result = await recordSignalHistory(DB, {
            now: US_AFTER_CLOSE,
            markers: null,
            ...fakeProviders(),
            budgetEndMs: Date.now() - 1,
        });

        expect(result).toEqual({ status: 'timed_out' });
        expect(repo.loadScanCursors).not.toHaveBeenCalled();
    });

    it('한 시장이 던져도 다른 시장은 기록한다', async () => {
        repo.loadScanCursors.mockImplementation(async (market: string) => {
            if (market === 'us') throw new Error('db down');
            return new Map();
        });

        const both = await runDone({
            now: new Date('2026-11-13T07:10:00.000Z'),
        });
        expect(both.kr).toMatchObject({ status: 'ran' });

        const us = await runDone();
        expect(us.us).toEqual({ status: 'failed' });
    });
});

describe('recordSignalHistory — 한글명', () => {
    it('대상 목록의 이름이 먼저이고, 없는 종목만 한 번에 조회하고, 조회에도 없으면 null이다', async () => {
        universe.targets.us = [
            { symbol: 'AAA', koreanName: '가나다' },
            { symbol: 'BBB', koreanName: null },
            { symbol: 'CCC', koreanName: null },
        ];
        koreanNames.mockResolvedValue({ BBB: '비비비', AAA: '조회값' });

        await runDone();

        expect(koreanNames).toHaveBeenCalledTimes(1);
        expect(koreanNames).toHaveBeenCalledWith(['BBB', 'CCC']);
        const names = Object.fromEntries(
            scanSymbolMock.mock.calls.map(([, target]) => [
                target.symbol,
                target.koreanName,
            ])
        );
        expect(names).toEqual({ AAA: '가나다', BBB: '비비비', CCC: null });
    });

    it('모든 종목에 이름이 있으면 조회하지 않는다', async () => {
        universe.targets.us = [{ symbol: 'AAA', koreanName: '가나다' }];

        await runDone();

        expect(koreanNames).not.toHaveBeenCalled();
    });

    it('이름 조회가 실패해도 기록은 이름 없이 계속된다', async () => {
        koreanNames.mockRejectedValue(new Error('db down'));

        const result = await runDone();

        expect(summaryOf(result.us)).toMatchObject({ recorded: 3 });
        expect(scanSymbolMock).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ symbol: 'AAA', koreanName: null })
        );
    });
});

describe('recordSignalHistory — 로그', () => {
    it('실행마다 scan run 한 줄에 호출 수·소요 시간을 담는다', async () => {
        const providers = fakeProviders();
        scanSymbolMock.mockImplementation(async (_ctx, target) => {
            providers.upstream.calls += 2;
            return {
                outcome: 'recorded',
                mode: target.cursor === undefined ? 'bootstrap' : 'catch_up',
                latestUnknown: target.symbol === 'CCC',
            };
        });
        repo.loadScanCursors.mockResolvedValue(
            new Map([['AAA', recordedCursor('2026-11-10')]])
        );

        await runDone({ providerFor: providers.providerFor });

        const line = vi
            .mocked(console.log)
            .mock.calls.map(([message]) => String(message))
            .find(message => message.startsWith('[signal-history] scan run:'));
        expect(line).toBeDefined();
        const payload: unknown = JSON.parse(
            (line ?? '').slice('[signal-history] scan run: '.length)
        );
        expect(payload).toEqual({
            market: 'us',
            session: SESSION,
            pending: 3,
            attempted: 3,
            recorded: 3,
            bootstrapped: 2,
            caughtUp: 1,
            failed: 0,
            stale: 0,
            nullLatest: 1,
            settledFailed: 0,
            completed: true,
            upstreamCalls: 6,
            elapsedMs: expect.any(Number),
            cpuMs: expect.any(Number),
        });
    });

    it('대상 목록 기준일이 200일을 넘게 오래됐으면 알린다', async () => {
        universe.asOf.us = '2026-01-01';

        await runDone();

        expect(console.warn).toHaveBeenCalledWith(
            '[signal-history] universe stale: us (as of 2026-01-01)'
        );
    });

    it('기준일이 최근이면 알리지 않는다', async () => {
        await runDone();

        expect(console.warn).not.toHaveBeenCalled();
    });
});
