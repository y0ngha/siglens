const { mockGetRedisClient, mockGetFundamentalFacts, mockRecord, mockProfile } =
    vi.hoisted(() => ({
        mockGetRedisClient: vi.fn(),
        mockGetFundamentalFacts: vi.fn(),
        mockRecord: vi.fn(),
        mockProfile: vi.fn(),
    }));

vi.mock('server-only', () => ({}));
vi.mock('@/shared/cache/redisClient', () => ({
    getRedisClient: mockGetRedisClient,
}));
vi.mock('@/entities/fundamental-facts/server/getFundamentalFacts', () => ({
    getFundamentalFacts: mockGetFundamentalFacts,
}));
vi.mock('@/entities/fundamental-facts/server/indexableStamp', () => ({
    recordFundamentalIndexable: mockRecord,
}));
vi.mock('@/entities/ticker/server/getProfileResilient', () => ({
    getProfileResilient: mockProfile,
}));

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    FUNDAMENTAL_STAMPS_PER_TICK,
    refreshFundamentalStamps,
} from '../fundamentalStamps';

const TICKERS = Array.from({ length: 20 }, (_, i) => `T${i}`);
const notPast = () => false;
/** 타임아웃이 나지 않는 sleep — 판정이 항상 먼저 끝난다. */
const never = () => new Promise<void>(() => {});

function fakeRedis(cursor: unknown) {
    return {
        get: vi.fn().mockResolvedValue(cursor),
        set: vi.fn().mockResolvedValue('OK'),
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockGetFundamentalFacts.mockResolvedValue({
        facts: [],
        complete: true,
        indexable: true,
    });
    mockRecord.mockResolvedValue(undefined);
    mockProfile.mockResolvedValue({
        profile: { sector: 'Technology' },
        degraded: false,
    });
});

describe('refreshFundamentalStamps', () => {
    it('커서부터 한 tick 분량을 순서대로 판정해 남기고 커서를 민다(끝에서 감는다)', async () => {
        const redis = fakeRedis(16);
        mockGetRedisClient.mockReturnValue(redis);

        const counts = await refreshFundamentalStamps(notPast, TICKERS, never);

        const seen = mockGetFundamentalFacts.mock.calls.map(([s]) => s);
        expect(seen).toEqual([
            'T16',
            'T17',
            'T18',
            'T19',
            'T0',
            'T1',
            'T2',
            'T3',
        ]);
        expect(seen).toHaveLength(FUNDAMENTAL_STAMPS_PER_TICK);
        expect(redis.set).toHaveBeenCalledWith(
            'fundamental-indexable:v1:cursor',
            (16 + FUNDAMENTAL_STAMPS_PER_TICK) % TICKERS.length
        );
        expect(counts).toEqual({ checked: 8, recorded: 8 });
    });

    it('커서가 없거나 이상하면 0부터 시작한다', async () => {
        mockGetRedisClient.mockReturnValue(fakeRedis(null));
        await refreshFundamentalStamps(notPast, TICKERS, never);
        expect(mockGetFundamentalFacts).toHaveBeenNthCalledWith(1, 'T0');
    });

    it('불완전한 판정은 남기지 않는다', async () => {
        mockGetRedisClient.mockReturnValue(fakeRedis(0));
        mockGetFundamentalFacts.mockResolvedValue({
            facts: [],
            complete: false,
            indexable: false,
        });

        const counts = await refreshFundamentalStamps(notPast, TICKERS, never);

        expect(mockRecord).not.toHaveBeenCalled();
        expect(counts).toEqual({ checked: 8, recorded: 0 });
    });

    it('데드라인이 지나면 멈추고, 시도한 수만큼만 커서를 민다', async () => {
        const redis = fakeRedis(5);
        mockGetRedisClient.mockReturnValue(redis);
        let calls = 0;
        const past = () => ++calls > 2;

        const counts = await refreshFundamentalStamps(past, TICKERS, never);

        expect(counts.checked).toBe(2);
        expect(redis.set).toHaveBeenLastCalledWith(
            'fundamental-indexable:v1:cursor',
            7
        );
    });

    it('판정이 상한을 넘기면 기다리기를 포기하고 다음 종목으로 간다', async () => {
        mockGetRedisClient.mockReturnValue(fakeRedis(0));
        // 판정이 끝나지 않는다(FMP가 매달린 상황) — sleep만 끝나므로 결과가 시점과 무관하게 정해진다.
        mockGetFundamentalFacts.mockImplementation(() => new Promise(() => {}));

        const counts = await refreshFundamentalStamps(notPast, TICKERS, () =>
            Promise.resolve()
        );

        // 모든 종목이 타임아웃으로 처리된다 — 하나도 기록하지 않고, 루프가 멈추지도 않는다.
        expect(counts).toEqual({ checked: 8, recorded: 0 });
        expect(mockRecord).not.toHaveBeenCalled();
    });

    it('프로필이 degrade면 남기지 않고, 프로필이 없으면 n을 남긴다(페이지 메타와 같은 판정)', async () => {
        mockGetRedisClient.mockReturnValue(fakeRedis(0));
        mockProfile
            .mockResolvedValueOnce({ profile: null, degraded: true })
            .mockResolvedValueOnce({ profile: null, degraded: false });

        await refreshFundamentalStamps(notPast, TICKERS, never);

        expect(mockRecord).not.toHaveBeenCalledWith('T0', expect.anything());
        expect(mockRecord).toHaveBeenCalledWith('T1', false);
        expect(mockGetFundamentalFacts).not.toHaveBeenCalledWith('T0');
        expect(mockGetFundamentalFacts).not.toHaveBeenCalledWith('T1');
        expect(mockRecord).toHaveBeenCalledWith('T2', true);
    });

    it('한 종목 실패는 건너뛰고, Redis가 없으면 아무것도 하지 않는다', async () => {
        mockGetRedisClient.mockReturnValue(fakeRedis(0));
        mockGetFundamentalFacts.mockRejectedValueOnce(new Error('boom'));

        const counts = await refreshFundamentalStamps(notPast, TICKERS, never);
        expect(counts).toEqual({ checked: 8, recorded: 7 });

        vi.clearAllMocks();
        mockGetRedisClient.mockReturnValue(null);
        expect(await refreshFundamentalStamps(notPast, TICKERS, never)).toEqual(
            {
                checked: 0,
                recorded: 0,
            }
        );
        expect(mockGetFundamentalFacts).not.toHaveBeenCalled();
    });
});
