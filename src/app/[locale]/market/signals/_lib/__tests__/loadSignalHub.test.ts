vi.mock('server-only', () => ({}));

const repo = vi.hoisted(() => ({
    listHubRows: vi.fn(),
    countHubSymbols: vi.fn(),
}));
vi.mock('@/entities/signal-history/api', () => ({
    SIGNAL_HISTORY_CACHE_TAG: 'signal-history',
    DrizzleSignalHistoryRepository: vi.fn().mockImplementation(function () {
        return repo;
    }),
}));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: () => ({ db: {} }),
}));
const cacheCalls = vi.hoisted(
    () => [] as { keyParts: unknown; options: unknown }[]
);
vi.mock('next/cache', () => ({
    unstable_cache:
        (fn: () => unknown, keyParts: unknown, options: unknown) => () => {
            cacheCalls.push({ keyParts, options });
            return fn();
        },
}));
const env = vi.hoisted(() => ({ offline: false, dbMissing: false }));
vi.mock('@/shared/api/offlineBuild', () => ({
    isOfflineBuild: () => env.offline,
}));
vi.mock('@/shared/db/config', () => ({
    isDatabaseMissingAtBuild: () => env.dbMissing,
}));
const pins = vi.hoisted(() => ({
    runtime: vi.fn(async () => {}),
    dbMissing: vi.fn(async () => {}),
}));
vi.mock('@/shared/cache/buildDegradedRevalidate', () => ({
    shortenRevalidateForRuntimeDegrade: pins.runtime,
    shortenRevalidateIfDatabaseMissingAtBuild: pins.dbMissing,
}));

import { loadSignalHub } from '../loadSignalHub';

const ROW = {
    market: 'us',
    symbol: 'NVDA',
    koreanName: '엔비디아',
    sessionDate: '2026-11-13',
    lastSeenSession: '2026-11-13',
    changePercent: 1,
} as const;

beforeEach(() => {
    env.offline = false;
    env.dbMissing = false;
    cacheCalls.length = 0;
    repo.listHubRows.mockReset().mockResolvedValue([ROW]);
    repo.countHubSymbols.mockReset().mockResolvedValue({ us: 1, kr: 0 });
    pins.runtime.mockClear();
    pins.dbMissing.mockClear();
    vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('loadSignalHub', () => {
    it('기록을 캐시 안에서 읽고, 신호 이력 태그와 1시간 TTL을 단다', async () => {
        const data = await loadSignalHub('golden_cross');

        expect(data).toEqual({
            rows: [ROW],
            counts: { us: 1, kr: 0 },
            degraded: false,
        });
        const call = cacheCalls.find(Boolean);
        expect(call?.options).toEqual({
            revalidate: 3600,
            tags: ['signal-history'],
        });
        expect(call?.keyParts).toEqual(
            expect.arrayContaining(['signal-hub', 'golden_cross'])
        );
    });

    it('미국 → 한국 순서로 돌려주고, 시장당 100개 상한과 신호·기간을 저장소에 넘긴다', async () => {
        const kr = { ...ROW, market: 'kr', symbol: '005930.KS' } as const;
        const aapl = { ...ROW, symbol: 'AAPL', sessionDate: '2026-11-01' };
        repo.listHubRows.mockResolvedValue([kr, ROW, aapl]);
        repo.countHubSymbols.mockResolvedValue({ us: 250, kr: 1 });

        const data = await loadSignalHub('death_cross');

        expect(data.rows).toEqual([ROW, aapl, kr]);
        expect(data.counts).toEqual({ us: 250, kr: 1 });
        expect(repo.listHubRows).toHaveBeenCalledWith(
            'death_cross',
            expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
            100
        );
        expect(repo.countHubSymbols).toHaveBeenCalledWith(
            'death_cross',
            expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/)
        );
    });

    it('캐시 키에 목록 형식 버전(v3)을 넣는다', async () => {
        await loadSignalHub('golden_cross');

        expect(cacheCalls.find(Boolean)?.keyParts).toEqual(
            expect.arrayContaining(['v3'])
        );
    });

    it('조회가 던지면 degraded로 돌려주고 재생성 주기를 짧게 건다(빈 목록과 구분)', async () => {
        repo.listHubRows.mockRejectedValue(new Error('db down'));

        const data = await loadSignalHub('death_cross');

        expect(data).toEqual({
            rows: [],
            counts: { us: 0, kr: 0 },
            degraded: true,
        });
        expect(pins.runtime).toHaveBeenCalledTimes(1);
    });

    it('빌드 중 DB가 없으면 조회하지 않고 degraded, 빌드 저하 핀을 건다', async () => {
        env.dbMissing = true;

        const data = await loadSignalHub('rsi_oversold');

        expect(data.degraded).toBe(true);
        expect(pins.dbMissing).toHaveBeenCalledTimes(1);
        expect(repo.listHubRows).not.toHaveBeenCalled();
    });

    it('오프라인 빌드는 조회하지 않고 degraded', async () => {
        env.offline = true;

        const data = await loadSignalHub('rsi_overbought');

        expect(data.degraded).toBe(true);
        expect(repo.listHubRows).not.toHaveBeenCalled();
    });
});
