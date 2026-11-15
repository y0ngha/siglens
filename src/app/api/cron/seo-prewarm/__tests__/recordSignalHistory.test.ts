import type { SectorSignalsResult } from '@y0ngha/siglens-core';

const repo = vi.hoisted(() => ({
    openEpisodeKeys: vi.fn(),
    insertEpisodes: vi.fn(),
    extendEpisodes: vi.fn(),
    pruneOlderThan: vi.fn(),
}));
vi.mock('@/entities/signal-history/api', () => ({
    DrizzleSignalHistoryRepository: vi.fn().mockImplementation(function () {
        return repo;
    }),
}));
// 기본 스캐너·Redis는 쓰지 않는다 — 모든 케이스가 scan·markers를 주입한다.
vi.mock('@/entities/sector-signal/api/sectorSignalsProvider', () => ({
    sectorSignalsProviderFor: vi.fn(),
}));
vi.mock('@/shared/cache/redisClient', () => ({ getRedisClient: () => null }));

import type { SiglensDatabase } from '@/shared/db/types';
import {
    recordSignalHistory,
    type RecordedMarkerStore,
    type RecordSignalHistoryResult,
    type ScanMarket,
} from '../recordSignalHistory';

const DB = {} as SiglensDatabase;
// 2026-11-13(금) 21:20 UTC = 16:20 ET(미국 마감+20분) = 11-14 06:20 KST(한국은 다음 날 새벽 → 건너뜀).
const US_AFTER_CLOSE = new Date('2026-11-13T21:20:00.000Z');
// 같은 날 07:10 UTC = 16:10 KST(한국 마감+40분) = 02:10 ET(미국은 장 열기 전 → 건너뜀).
const KR_AFTER_CLOSE = new Date('2026-11-13T07:10:00.000Z');

function scanResult(symbol: string): SectorSignalsResult {
    return {
        computedAt: US_AFTER_CLOSE.toISOString(),
        stocks: [
            {
                symbol,
                koreanName: '',
                sectorSymbol: 'XLK',
                price: 1,
                changePercent: 1,
                trend: 'uptrend',
                signals: [
                    {
                        type: 'golden_cross',
                        phase: 'confirmed',
                        direction: 'bullish',
                        detectedAt: 0,
                    },
                ],
            },
        ],
    };
}

const scanNvda: ScanMarket = async () => scanResult('NVDA');

const RECORDED_US = 'signal-history:recorded:v1:us:2026-11-13';
const ATTEMPT_US = 'signal-history:attempt:v1:us:2026-11-13';

function memoryMarkers(initial: readonly string[] = []): RecordedMarkerStore & {
    readonly keys: Set<string>;
} {
    const keys = new Set(initial);
    return {
        keys,
        has: async key => keys.has(key),
        mark: async key => {
            keys.add(key);
        },
    };
}

async function runDone(options: {
    now: Date;
    scan?: ScanMarket;
    markers?: RecordedMarkerStore | null;
}): Promise<Extract<RecordSignalHistoryResult, { status: 'done' }>> {
    const result = await recordSignalHistory(DB, {
        scan: scanNvda,
        markers: null,
        ...options,
    });
    if (result.status !== 'done') throw new Error('expected done');
    return result;
}

beforeEach(() => {
    repo.openEpisodeKeys.mockReset().mockResolvedValue([]);
    repo.insertEpisodes
        .mockReset()
        .mockImplementation(async (rows: readonly unknown[]) => rows.length);
    repo.extendEpisodes
        .mockReset()
        .mockImplementation(
            async (_m: string, keys: readonly unknown[]) => keys.length
        );
    repo.pruneOlderThan.mockReset().mockResolvedValue(3);
    vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe('recordSignalHistory', () => {
    it('미국 마감 뒤에는 미국만 기록하고 한국은 건너뛴다', async () => {
        const scan = vi.fn(scanNvda);

        const result = await runDone({ now: US_AFTER_CLOSE, scan });

        expect(result.us).toEqual({
            status: 'recorded',
            sessionDate: '2026-11-13',
            inserted: 1,
            extended: 0,
        });
        expect(result.kr).toEqual({ status: 'skipped' });
        expect(scan.mock.calls.map(([market]) => market)).toEqual(['us']);
    });

    it('한국 마감 뒤에는 한국만 기록한다', async () => {
        const result = await runDone({ now: KR_AFTER_CLOSE });

        expect(result.kr).toMatchObject({
            status: 'recorded',
            sessionDate: '2026-11-13',
        });
        expect(result.us).toEqual({ status: 'skipped' });
    });

    it('장중에는 스캐너를 부르지도 않는다', async () => {
        const scan = vi.fn(scanNvda);

        const result = await runDone({
            now: new Date('2026-11-13T18:00:00.000Z'),
            scan,
        });

        expect(result.us).toEqual({ status: 'skipped' });
        expect(scan).not.toHaveBeenCalled();
    });

    it('이어짐 판정은 그 시장·직전 세션 기준으로 조회한다', async () => {
        await runDone({ now: US_AFTER_CLOSE });

        expect(repo.openEpisodeKeys).toHaveBeenCalledWith(
            'us',
            ['NVDA'],
            '2026-11-12'
        );
    });

    it('직전 세션부터 이어진 신호는 새로 넣지 않고 늘린다', async () => {
        repo.openEpisodeKeys.mockResolvedValue([
            { symbol: 'NVDA', signalType: 'golden_cross' },
        ]);

        const result = await runDone({ now: US_AFTER_CLOSE });

        expect(repo.insertEpisodes).toHaveBeenCalledWith([]);
        expect(repo.extendEpisodes).toHaveBeenCalledWith(
            'us',
            [{ symbol: 'NVDA', signalType: 'golden_cross' }],
            '2026-11-13',
            '2026-11-12'
        );
        expect(result.us).toMatchObject({ inserted: 0, extended: 1 });
    });

    it('세션을 남기면 표식을 찍고, 표식이 있으면 다음 실행은 스캐너도 부르지 않는다', async () => {
        const markers = memoryMarkers();
        await runDone({ now: US_AFTER_CLOSE, markers });
        expect(markers.keys).toContain(RECORDED_US);

        const scan = vi.fn(scanNvda);
        const second = await runDone({
            now: new Date(US_AFTER_CLOSE.getTime() + 5 * 60_000),
            markers,
            scan,
        });

        expect(second.us).toEqual({ status: 'skipped' });
        expect(scan).not.toHaveBeenCalled();
    });

    it('실패한 시장은 기록 표식 없이 시도 표식만 남긴다 — 시도 간격 뒤 다시 시도한다', async () => {
        const markers = memoryMarkers();
        repo.insertEpisodes.mockRejectedValue(new Error('db down'));

        const result = await runDone({ now: US_AFTER_CLOSE, markers });

        expect(result.us).toEqual({ status: 'failed' });
        expect([...markers.keys]).toEqual([ATTEMPT_US]);
    });

    it('시도 표식이 살아 있는 동안(30분)은 빈 결과·실패 뒤에도 다시 계산하지 않는다', async () => {
        const markers = memoryMarkers([ATTEMPT_US]);
        const scan = vi.fn(scanNvda);

        const result = await runDone({ now: US_AFTER_CLOSE, markers, scan });

        expect(result.us).toEqual({ status: 'skipped' });
        expect(scan).not.toHaveBeenCalled();
    });

    it('시도 표식은 30분짜리로 스캔 전에 찍는다(스캔이 멈춰도 재시도가 몰리지 않게)', async () => {
        const mark = vi.fn(async (_key: string, _ttlSeconds: number) => {});
        const markers: RecordedMarkerStore = { has: async () => false, mark };
        let markedBeforeScan = false;

        await runDone({
            now: US_AFTER_CLOSE,
            markers,
            scan: async market => {
                markedBeforeScan = mark.mock.calls.some(
                    ([key]) => key === ATTEMPT_US
                );
                return scanNvda(market, US_AFTER_CLOSE);
            },
        });

        expect(markedBeforeScan).toBe(true);
        expect(mark).toHaveBeenCalledWith(ATTEMPT_US, 30 * 60);
    });

    it('스캐너 결과가 비면 건너뛴다', async () => {
        const result = await runDone({
            now: US_AFTER_CLOSE,
            scan: async () => ({ computedAt: '', stocks: [] }),
        });

        expect(result.us).toEqual({ status: 'skipped' });
        expect(repo.openEpisodeKeys).not.toHaveBeenCalled();
    });

    it('기록한 실행에서만 보존 기간(400일)이 지난 행을 지운다', async () => {
        const recorded = await runDone({ now: US_AFTER_CLOSE });
        expect(recorded.pruned).toBe(3);
        expect(repo.pruneOlderThan).toHaveBeenCalledWith('2025-10-09');

        repo.pruneOlderThan.mockClear();
        const idle = await runDone({
            now: new Date('2026-11-13T18:00:00.000Z'),
        });
        expect(idle.pruned).toBeNull();
        expect(repo.pruneOlderThan).not.toHaveBeenCalled();
    });

    it('정리가 던져도 결과를 돌려준다(pruned=null)', async () => {
        repo.pruneOlderThan.mockRejectedValue(new Error('db'));

        const result = await runDone({ now: US_AFTER_CLOSE });

        expect(result.pruned).toBeNull();
        expect(result.us).toMatchObject({ status: 'recorded' });
    });

    it('예산 안에 끝나지 않으면(멈춘 프로바이더) 기다리지 않고 timed_out', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(US_AFTER_CLOSE);

        const pending = recordSignalHistory(DB, {
            now: US_AFTER_CLOSE,
            markers: null,
            scan: () => new Promise(() => {}),
            budgetEndMs: US_AFTER_CLOSE.getTime() + 5_000,
        });
        await vi.advanceTimersByTimeAsync(5_000);

        await expect(pending).resolves.toEqual({ status: 'timed_out' });
    });

    it('남은 예산이 없으면 시작하지 않는다', async () => {
        const scan = vi.fn(scanNvda);

        const result = await recordSignalHistory(DB, {
            now: US_AFTER_CLOSE,
            markers: null,
            scan,
            budgetEndMs: Date.now() - 1,
        });

        expect(result).toEqual({ status: 'timed_out' });
        expect(scan).not.toHaveBeenCalled();
    });
});
