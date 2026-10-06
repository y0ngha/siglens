vi.mock('server-only', () => ({}));

const { mockRedisGet, mockRedisSet, mockGetRedisClient } = vi.hoisted(() => ({
    mockRedisGet: vi.fn(),
    mockRedisSet: vi.fn(),
    mockGetRedisClient: vi.fn(),
}));

vi.mock('@/shared/cache/redisClient', () => ({
    getRedisClient: mockGetRedisClient,
}));

vi.mock('../optionsDataCache', () => ({
    readLastGoodCapturedAt: vi.fn(),
    refreshLastGoodSnapshot: vi.fn(),
}));

import {
    OPTIONS_WARM_CONCURRENCY,
    OPTIONS_WARM_CURSOR_KEY,
    OPTIONS_WARM_DEADLINE_MS,
    OPTIONS_WARM_REFRESH_TIMEOUT_MS,
    warmOptionsLastGood,
} from '../warmOptionsLastGood';
import {
    readLastGoodCapturedAt,
    refreshLastGoodSnapshot,
} from '../optionsDataCache';
import {
    OPTIONS_WARM_SYMBOLS_PER_TICK,
    buildOptionsWarmUniverse,
} from '../selectOptionsWarmSymbols';

const universe = buildOptionsWarmUniverse();
// 2026-10-05(월) 16:30 EDT — 워밍 구간. 오늘 마감은 20:00Z.
const IN_WINDOW = new Date('2026-10-05T20:30:00.000Z');
const CLOSE_MS = Date.parse('2026-10-05T20:00:00.000Z');
const COMPLETE_KEY = `options-warm:complete:${CLOSE_MS}`;
const AFTER_CLOSE = '2026-10-05T20:20:00.000Z';
const BEFORE_CLOSE = '2026-10-05T19:00:00.000Z';

const mockRefresh = vi.mocked(refreshLastGoodSnapshot);
const mockCapturedAt = vi.mocked(readLastGoodCapturedAt);

function refreshedSymbols(): string[] {
    return mockRefresh.mock.calls.map(([symbol]) => symbol);
}

/** key별로 다른 값을 돌려주는 Redis get — 커서와 완료 표식이 같은 목을 쓰므로 키로 가른다. */
function redisHolds(values: Record<string, unknown>): void {
    mockRedisGet.mockImplementation(async (key: string) =>
        key in values ? values[key] : null
    );
}

function cursorWrites(): unknown[] {
    return mockRedisSet.mock.calls
        .filter(([key]) => key === OPTIONS_WARM_CURSOR_KEY)
        .map(([, value]) => value);
}

describe('warmOptionsLastGood', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(IN_WINDOW);
        mockGetRedisClient.mockReturnValue({
            get: mockRedisGet,
            set: mockRedisSet,
        });
        mockRedisGet.mockResolvedValue(null);
        mockRedisSet.mockResolvedValue('OK');
        mockCapturedAt.mockResolvedValue(null);
        mockRefresh.mockResolvedValue('written');
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('구간 밖이면 Redis도 Yahoo도 건드리지 않는다', async () => {
        const result = await warmOptionsLastGood(
            new Date('2026-10-05T15:00:00.000Z')
        );

        expect(result).toEqual({ status: 'out_of_window' });
        expect(mockGetRedisClient).not.toHaveBeenCalled();
        expect(mockRefresh).not.toHaveBeenCalled();
    });

    it('휴장일에는 구간 안 시각이어도 아무것도 하지 않는다', async () => {
        const result = await warmOptionsLastGood(
            new Date('2026-11-26T22:00:00.000Z')
        );

        expect(result).toEqual({ status: 'out_of_window' });
        expect(mockRefresh).not.toHaveBeenCalled();
    });

    it('Redis가 없으면 no_redis로 끝내고 Yahoo를 치지 않는다', async () => {
        mockGetRedisClient.mockReturnValue(null);

        const result = await warmOptionsLastGood(IN_WINDOW);

        expect(result).toEqual({ status: 'no_redis' });
        expect(mockRefresh).not.toHaveBeenCalled();
    });

    it('커서가 없으면 유니버스 앞에서 tick당 6개를 고르고 커서를 6으로 전진시킨다', async () => {
        const result = await warmOptionsLastGood(IN_WINDOW);

        expect(OPTIONS_WARM_SYMBOLS_PER_TICK).toBe(6);
        expect(refreshedSymbols()).toEqual(universe.slice(0, 6));
        expect(cursorWrites()).toEqual([6]);
        expect(result).toEqual({
            status: 'ran',
            written: 6,
            stale: 0,
            none: 0,
            skipped: 0,
            deferred: 0,
        });
        expect(mockRedisGet).toHaveBeenCalledWith(OPTIONS_WARM_CURSOR_KEY);
    });

    it('저장된 커서(문자열이어도)부터 이어서 고른다', async () => {
        redisHolds({ [OPTIONS_WARM_CURSOR_KEY]: '12' });

        await warmOptionsLastGood(IN_WINDOW);

        expect(refreshedSymbols()).toEqual(universe.slice(12, 18));
        expect(cursorWrites()).toEqual([18]);
    });

    it('유니버스 끝에서 처음으로 감싸고 커서도 모듈로로 저장한다', async () => {
        redisHolds({ [OPTIONS_WARM_CURSOR_KEY]: universe.length - 2 });

        await warmOptionsLastGood(IN_WINDOW);

        expect(refreshedSymbols()).toEqual([
            ...universe.slice(-2),
            ...universe.slice(0, 4),
        ]);
        expect(cursorWrites()).toEqual([4]);
    });

    it('깨진 커서 값은 0으로 취급한다', async () => {
        redisHolds({ [OPTIONS_WARM_CURSOR_KEY]: 'not-a-number' });

        await warmOptionsLastGood(IN_WINDOW);

        expect(refreshedSymbols()).toEqual(universe.slice(0, 6));
    });

    it('오늘 마감 이후 last-good이 이미 있는 종목은 Yahoo를 치지 않고 건너뛴다', async () => {
        const captured = new Set(universe.slice(0, 2));
        mockCapturedAt.mockImplementation(async symbol =>
            captured.has(symbol) ? AFTER_CLOSE : null
        );

        const result = await warmOptionsLastGood(IN_WINDOW);

        expect(refreshedSymbols()).toEqual(universe.slice(2, 8));
        expect(result).toMatchObject({ skipped: 2, written: 6 });
        // 건너뛴 2개도 걸음에 센다.
        expect(cursorWrites()).toEqual([8]);
    });

    it('마감 이전에 저장된 last-good(어제·오늘 장중)은 확보로 보지 않는다', async () => {
        mockCapturedAt.mockResolvedValue(BEFORE_CLOSE);

        const result = await warmOptionsLastGood(IN_WINDOW);

        expect(refreshedSymbols()).toEqual(universe.slice(0, 6));
        expect(result).toMatchObject({ skipped: 0 });
    });

    it('마감 시각과 정확히 같은 capturedAt은 확보로 보지 않는다(엄격히 이후만)', async () => {
        mockCapturedAt.mockResolvedValue(new Date(CLOSE_MS).toISOString());

        const result = await warmOptionsLastGood(IN_WINDOW);

        expect(result).toMatchObject({ skipped: 0 });
        expect(mockRefresh).toHaveBeenCalledTimes(6);
    });

    it('해석할 수 없는 capturedAt은 확보로 보지 않는다', async () => {
        mockCapturedAt.mockResolvedValue('garbage');

        const result = await warmOptionsLastGood(IN_WINDOW);

        expect(result).toMatchObject({ skipped: 0 });
        expect(mockRefresh).toHaveBeenCalledTimes(6);
    });

    it('전부 확보된 날에는 Yahoo를 치지 않고 완료 표식을 창 끝까지의 TTL로 남긴다', async () => {
        mockCapturedAt.mockResolvedValue(AFTER_CLOSE);

        const result = await warmOptionsLastGood(IN_WINDOW);

        expect(mockRefresh).not.toHaveBeenCalled();
        expect(result).toMatchObject({
            status: 'ran',
            written: 0,
            skipped: universe.length,
        });
        expect(cursorWrites()).toEqual([0]);
        // 20:30Z → 창 끝 23:45Z = 3시간 15분.
        expect(mockRedisSet).toHaveBeenCalledWith(COMPLETE_KEY, 1, {
            ex: 11_700,
        });
    });

    it('일부만 확보된 날에는 완료 표식을 남기지 않는다', async () => {
        const captured = new Set(universe.slice(0, 2));
        mockCapturedAt.mockImplementation(async symbol =>
            captured.has(symbol) ? AFTER_CLOSE : null
        );

        await warmOptionsLastGood(IN_WINDOW);

        expect(
            mockRedisSet.mock.calls.filter(([key]) => key === COMPLETE_KEY)
        ).toHaveLength(0);
    });

    it('완료 표식이 있으면 last-good을 한 건도 읽지 않고 Redis 조회 1회로 끝낸다', async () => {
        redisHolds({ [COMPLETE_KEY]: 1 });

        const result = await warmOptionsLastGood(IN_WINDOW);

        expect(result).toEqual({ status: 'complete' });
        expect(mockCapturedAt).not.toHaveBeenCalled();
        expect(mockRefresh).not.toHaveBeenCalled();
        expect(mockRedisGet).toHaveBeenCalledTimes(1);
    });

    it('다음 거래일의 완료 표식은 다른 키라 무시된다', async () => {
        redisHolds({ 'options-warm:complete:1': 1 });

        const result = await warmOptionsLastGood(IN_WINDOW);

        expect(result).toMatchObject({ status: 'ran' });
    });

    it('written·stale·none 결과를 각각 집계한다', async () => {
        const outcomes = [
            'written',
            'stale',
            'none',
            'written',
            'stale',
            'stale',
        ] as const;
        mockRefresh.mockImplementation(async symbol => {
            return outcomes[universe.indexOf(symbol)];
        });

        const result = await warmOptionsLastGood(IN_WINDOW);

        expect(result).toEqual({
            status: 'ran',
            written: 2,
            stale: 3,
            none: 1,
            skipped: 0,
            deferred: 0,
        });
    });

    it(`동시에 ${OPTIONS_WARM_CONCURRENCY}개까지만 Yahoo를 친다`, async () => {
        let inFlight = 0;
        let maxInFlight = 0;
        mockRefresh.mockImplementation(async () => {
            inFlight += 1;
            maxInFlight = Math.max(maxInFlight, inFlight);
            await Promise.resolve();
            await Promise.resolve();
            inFlight -= 1;
            return 'written';
        });

        await warmOptionsLastGood(IN_WINDOW);

        expect(maxInFlight).toBe(OPTIONS_WARM_CONCURRENCY);
        expect(mockRefresh).toHaveBeenCalledTimes(6);
    });

    it('시간 예산을 넘기면 남은 종목을 미루고 커서를 그 종목 앞에 둔다', async () => {
        // 첫 두 건(동시 시작)이 끝나는 순간 예산이 소진된다.
        mockRefresh.mockImplementation(async () => {
            // 두 번째 워커가 시작할 틈을 준 뒤에 예산을 소진시킨다.
            await Promise.resolve();
            vi.setSystemTime(
                new Date(Date.now() + OPTIONS_WARM_DEADLINE_MS + 1)
            );
            return 'written';
        });

        const result = await warmOptionsLastGood(IN_WINDOW);

        expect(refreshedSymbols()).toEqual(universe.slice(0, 2));
        expect(result).toMatchObject({ written: 2, deferred: 4 });
        expect(cursorWrites()).toEqual([2]);
    });

    it('미룬 종목 앞에 건너뛴 종목이 있으면 그 걸음까지는 전진한다', async () => {
        const captured = new Set([universe[0]]);
        mockCapturedAt.mockImplementation(async symbol =>
            captured.has(symbol) ? AFTER_CLOSE : null
        );
        mockRefresh.mockImplementation(async () => {
            // 두 번째 워커가 시작할 틈을 준 뒤에 예산을 소진시킨다.
            await Promise.resolve();
            vi.setSystemTime(
                new Date(Date.now() + OPTIONS_WARM_DEADLINE_MS + 1)
            );
            return 'written';
        });

        await warmOptionsLastGood(IN_WINDOW);

        // 시작한 건 universe[1], [2] — 다음 후보는 [3]이므로 커서는 3.
        expect(refreshedSymbols()).toEqual(universe.slice(1, 3));
        expect(cursorWrites()).toEqual([3]);
    });

    it('커서 쓰기 실패는 흡수하고 결과는 그대로 돌려준다', async () => {
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        mockRedisSet.mockRejectedValue(new Error('redis write fail'));

        const result = await warmOptionsLastGood(IN_WINDOW);

        expect(result).toMatchObject({ status: 'ran', written: 6 });
        expect(errSpy).toHaveBeenCalled();
        errSpy.mockRestore();
    });

    it('커서 읽기가 실패하면 던진다(호출자 route가 격리한다)', async () => {
        mockRedisGet.mockRejectedValue(new Error('redis down'));

        await expect(warmOptionsLastGood(IN_WINDOW)).rejects.toThrow(
            'redis down'
        );
        expect(mockRefresh).not.toHaveBeenCalled();
    });
    describe('시간 경계', () => {
        it('남은 예산이 종목 타임아웃보다 작으면 건너뛴다', async () => {
            const result = await warmOptionsLastGood(IN_WINDOW, {
                budgetEndMs: Date.now() + OPTIONS_WARM_REFRESH_TIMEOUT_MS - 1,
            });

            expect(result).toEqual({ status: 'no_budget' });
            expect(mockRedisGet).not.toHaveBeenCalled();
            expect(mockRefresh).not.toHaveBeenCalled();
        });

        it('새 종목 시작 마감을 락 예산에서 종목 타임아웃을 뺀 시각으로 당긴다', async () => {
            // 시작 마감 = 예산 끝 − 15s = 지금 + 1s. 첫 두 건이 끝나는 순간 1s가 지난다.
            mockRefresh.mockImplementation(async () => {
                await Promise.resolve();
                vi.setSystemTime(new Date(Date.now() + 1000));
                return 'written';
            });

            const result = await warmOptionsLastGood(IN_WINDOW, {
                budgetEndMs:
                    Date.now() + OPTIONS_WARM_REFRESH_TIMEOUT_MS + 1000,
            });

            expect(refreshedSymbols()).toEqual(universe.slice(0, 2));
            expect(result).toMatchObject({ written: 2, deferred: 4 });
        });

        it('예산이 넉넉하면 45초 마감이 적용된다', async () => {
            mockRefresh.mockImplementation(async () => {
                await Promise.resolve();
                vi.setSystemTime(
                    new Date(Date.now() + OPTIONS_WARM_DEADLINE_MS)
                );
                return 'written';
            });

            const result = await warmOptionsLastGood(IN_WINDOW, {
                budgetEndMs: Date.now() + 840_000,
            });

            expect(result).toMatchObject({ written: 2, deferred: 4 });
        });
    });
});

describe('warmOptionsLastGood — 멈춘 호출 (가짜 타이머)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        vi.setSystemTime(IN_WINDOW);
        mockGetRedisClient.mockReturnValue({
            get: mockRedisGet,
            set: mockRedisSet,
        });
        mockRedisGet.mockResolvedValue(null);
        mockRedisSet.mockResolvedValue('OK');
        mockCapturedAt.mockResolvedValue(null);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('멈춘 refresh는 종목 타임아웃에서 none으로 끊고 나머지를 이어서 처리한다', async () => {
        mockRefresh.mockImplementation(async symbol =>
            symbol === universe[0] ? new Promise<never>(() => {}) : 'written'
        );

        const promise = warmOptionsLastGood(IN_WINDOW);
        await vi.advanceTimersByTimeAsync(OPTIONS_WARM_REFRESH_TIMEOUT_MS);
        const result = await promise;

        expect(result).toEqual({
            status: 'ran',
            written: 5,
            stale: 0,
            none: 1,
            skipped: 0,
            deferred: 0,
        });
        // 멈춘 종목 때문에 커서가 멈추지 않는다.
        expect(cursorWrites()).toEqual([6]);
    });

    it('전부 멈춰도 시작 마감 + 종목 타임아웃 안에 끝난다', async () => {
        mockRefresh.mockImplementation(() => new Promise<never>(() => {}));
        const startedAt = Date.now();

        const promise = warmOptionsLastGood(IN_WINDOW);
        await vi.advanceTimersByTimeAsync(
            OPTIONS_WARM_DEADLINE_MS + OPTIONS_WARM_REFRESH_TIMEOUT_MS
        );
        const result = await promise;

        expect(result).toMatchObject({ status: 'ran' });
        expect(Date.now() - startedAt).toBeLessThanOrEqual(
            OPTIONS_WARM_DEADLINE_MS + OPTIONS_WARM_REFRESH_TIMEOUT_MS
        );
    });

    it('Redis가 멈추면 락 예산 끝에서 timed_out으로 끊는다', async () => {
        mockRedisGet.mockImplementation(() => new Promise<never>(() => {}));
        const budget = 2 * OPTIONS_WARM_REFRESH_TIMEOUT_MS;

        const promise = warmOptionsLastGood(IN_WINDOW, {
            budgetEndMs: Date.now() + budget,
        });
        await vi.advanceTimersByTimeAsync(budget);

        await expect(promise).resolves.toEqual({ status: 'timed_out' });
        expect(mockRefresh).not.toHaveBeenCalled();
    });
});
