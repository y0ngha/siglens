vi.mock('server-only', () => ({}));

const { cache, x, wikidata, budget } = vi.hoisted(() => ({
    cache: {
        store: new Map<string, unknown>(),
        writes: [] as { key: string; ttl: number }[],
    },
    x: {
        token: 'tok' as string | null,
        users: vi.fn(),
        timeline: vi.fn(),
    },
    wikidata: { fetch: vi.fn() },
    budget: {
        reserve: vi.fn(
            async (
                _units: number,
                _options: BudgetOptions
            ): Promise<Reservation> => 'reserved'
        ),
        refund: vi.fn(
            async (_units: number, _options: BudgetOptions): Promise<void> =>
                undefined
        ),
    },
}));

vi.mock('@/shared/cache/getOrSetCache', () => ({
    getOrSetCache: async (
        key: string,
        ttl: number | ((value: unknown) => number),
        fetcher: () => Promise<unknown>
    ) => {
        if (cache.store.has(key)) return cache.store.get(key);
        const value = await fetcher();
        cache.store.set(key, value);
        cache.writes.push({
            key,
            ttl: typeof ttl === 'function' ? ttl(value) : ttl,
        });
        return value;
    },
}));
vi.mock('@/shared/api/x/xClient', async importOriginal => {
    const real =
        await importOriginal<typeof import('@/shared/api/x/xClient')>();
    return {
        XApiError: real.XApiError,
        xBearerToken: () => x.token,
        fetchXUsersByUsernames: x.users,
        fetchXTimelinePage: x.timeline,
    };
});
vi.mock('@/shared/api/wikidata/stockXAccounts', () => ({
    fetchStockXAccounts: wikidata.fetch,
}));
vi.mock('../xDailyBudget', () => ({
    reserveXReads: budget.reserve,
    refundXReads: budget.refund,
}));

import {
    AGENT_X_POSTS_MAX,
    AGENT_X_POSTS_PAGE_SIZE,
} from '@y0ngha/siglens-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { XApiError } from '@/shared/api/x/xClient';
import { getXPosts } from '../getXPosts';

type Reservation = 'reserved' | 'exhausted' | 'unavailable';
interface BudgetOptions {
    guest: boolean;
    now?: Date;
}

const MEMBER = { guest: false };
const PAGE = AGENT_X_POSTS_PAGE_SIZE;

const hoursAgo = (h: number) =>
    new Date(Date.now() - (h + 1) * 3_600_000).toISOString();
const rawPost = (id: string, h: number) => ({
    id,
    text: `post ${id}`,
    createdAt: hoursAgo(h),
    likes: 1,
    reposts: 0,
});
const page = (posts: ReturnType<typeof rawPost>[], hasMore = false) => ({
    posts,
    hasMore,
    billedItems: posts.length,
});
const user = (id: string, username: string, followers: number) => ({
    id,
    username,
    name: username,
    followers,
});

const TESLA_ID = '13298072';
const MUSK_ID = '44196397';

/** TSLA: 큐레이션 표가 회사(@Tesla)·CEO(@elonmusk)를 모두 채운다 — 위키데이터를 묻지 않는다. */
function teslaUsers() {
    x.users.mockResolvedValue({
        users: [
            user(TESLA_ID, 'Tesla', 30_000_000),
            user(MUSK_ID, 'elonmusk', 200_000_000),
        ],
        billedItems: 2,
    });
}

const refunds = () => budget.refund.mock.calls.map(call => call[0]);

beforeEach(() => {
    cache.store.clear();
    cache.writes.length = 0;
    x.token = 'tok';
    x.users.mockReset();
    x.timeline.mockReset();
    wikidata.fetch.mockReset();
    budget.reserve.mockReset();
    budget.reserve.mockResolvedValue('reserved');
    budget.refund.mockClear();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

describe('getXPosts', () => {
    it('TSLA: 두 계정을 읽어 계정 행·글을 싣고, 위키데이터는 묻지 않는다', async () => {
        teslaUsers();
        x.timeline.mockImplementation(async (userId: string) =>
            userId === MUSK_ID
                ? page([rawPost('901', 1), rawPost('902', 30)], true)
                : page([rawPost('801', 5)])
        );
        const result = await getXPosts('TSLA', MEMBER);
        expect(wikidata.fetch).not.toHaveBeenCalled();
        if (result.status !== 'ok') throw new Error('expected ok');
        expect(result.accounts).toEqual([
            {
                handle: 'Tesla',
                name: 'Tesla',
                role: 'company',
                followers: 30_000_000,
                loaded: true,
                postsInWindow: 1,
                moreInWindow: false,
            },
            {
                handle: 'elonmusk',
                name: 'Elon Musk',
                role: 'ceo',
                followers: 200_000_000,
                loaded: true,
                postsInWindow: 2,
                moreInWindow: true,
            },
        ]);
        expect(result.posts.map(p => p.url)).toEqual([
            'https://x.com/elonmusk/status/901',
            'https://x.com/Tesla/status/801',
            'https://x.com/elonmusk/status/902',
        ]);
        expect(x.timeline).toHaveBeenCalledWith(MUSK_ID, {
            startTime: expect.any(Date),
            pageSize: PAGE,
        });
    });

    it('예산: 사용자 조회는 후보 수, 타임라인은 한 페이지를 예약하고 X가 돌려준 항목 수를 뺀 나머지를 돌려준다', async () => {
        teslaUsers();
        x.timeline.mockResolvedValue({
            posts: [rawPost('1', 1)],
            hasMore: false,
            billedItems: 3, // 모양이 틀려 버린 두 건도 과금된다
        });
        await getXPosts('TSLA', MEMBER);
        expect(budget.reserve.mock.calls.map(call => call[0])).toEqual([
            2,
            PAGE,
            PAGE,
        ]);
        expect(refunds().toSorted((a, b) => a - b)).toEqual([
            0,
            PAGE - 3,
            PAGE - 3,
        ]);
    });

    it('게스트 요청이면 예산에 guest를 넘긴다', async () => {
        teslaUsers();
        x.timeline.mockResolvedValue(page([]));
        await getXPosts('TSLA', { guest: true });
        for (const call of budget.reserve.mock.calls)
            expect(call[1]).toMatchObject({ guest: true });
    });

    it('빈 타임라인도 한 건으로 센다(빈 응답도 과금 단위)', async () => {
        teslaUsers();
        x.timeline.mockResolvedValue(page([]));
        expect(await getXPosts('TSLA', MEMBER)).toMatchObject({
            status: 'ok',
            posts: [],
        });
        expect(refunds().filter(units => units === PAGE - 1)).toHaveLength(2);
    });

    it('캐시: 계정 7일(종목), 타임라인 1시간(사용자 ID) — 두 번째 호출은 X를 부르지 않는다', async () => {
        teslaUsers();
        x.timeline.mockResolvedValue(page([rawPost('1', 1)]));
        await getXPosts('TSLA', MEMBER);
        expect(cache.writes).toEqual(
            expect.arrayContaining([
                { key: 'x:accounts:v1:TSLA', ttl: 604_800 },
                { key: `x:timeline:v1:${TESLA_ID}`, ttl: 3_600 },
                { key: `x:timeline:v1:${MUSK_ID}`, ttl: 3_600 },
            ])
        );
        await getXPosts('TSLA', MEMBER);
        expect(x.users).toHaveBeenCalledTimes(1);
        expect(x.timeline).toHaveBeenCalledTimes(2);
        expect(budget.reserve).toHaveBeenCalledTimes(3);
    });

    it('타임라인 캐시는 계정 정보를 싣지 않아, 같은 사용자를 다른 종목·역할이 읽으면 그 역할로 붙는다', async () => {
        // @elonmusk는 TSLA에서 CEO다. 위키데이터가 다른 종목의 회사 계정으로 같은 사용자를 가리키는 경우.
        teslaUsers();
        x.timeline.mockResolvedValue(page([rawPost('1', 1)]));
        await getXPosts('TSLA', MEMBER);
        expect(cache.store.get(`x:timeline:v1:${MUSK_ID}`)).not.toHaveProperty(
            'posts.0.role'
        );
        wikidata.fetch.mockResolvedValue({
            companyHandles: ['elonmusk'],
            executives: [],
        });
        x.users.mockResolvedValue({
            users: [user(MUSK_ID, 'elonmusk', 200_000_000)],
            billedItems: 1,
        });
        const other = await getXPosts('ZZZZ', MEMBER);
        if (other.status !== 'ok') throw new Error('expected ok');
        expect(other.posts.map(p => p.role)).toEqual(['company']);
        expect(x.timeline).toHaveBeenCalledTimes(2);
    });

    it('한 계정만 읽히면 ok이고 못 읽은 계정은 loaded:false(수치 null), HTTP 오류는 예약 전부를 돌려준다', async () => {
        teslaUsers();
        x.timeline.mockImplementation(async (userId: string) => {
            if (userId === MUSK_ID)
                throw new XApiError('x responded 503', 503, 'none');
            return page([rawPost('1', 1)]);
        });
        const result = await getXPosts('TSLA', MEMBER);
        if (result.status !== 'ok') throw new Error('expected ok');
        expect(result.accounts[1]).toMatchObject({
            handle: 'elonmusk',
            loaded: false,
            postsInWindow: null,
            moreInWindow: null,
        });
        expect(refunds()).toContain(PAGE);
        expect(cache.store.has(`x:timeline:v1:${MUSK_ID}`)).toBe(false);
    });

    it('과금 여부를 모르는 실패(타임아웃·쓸 수 없는 200)는 예약을 돌려주지 않는다', async () => {
        teslaUsers();
        x.timeline.mockRejectedValue(
            new XApiError('x request failed: TimeoutError', null, 'unknown')
        );
        expect(await getXPosts('TSLA', MEMBER)).toEqual({
            status: 'provider_failed',
        });
        expect(refunds()).not.toContain(PAGE);
    });

    it('하루 예산이 차서 아무 계정도 못 읽으면 quota, 저장소 장애는 provider_failed', async () => {
        teslaUsers();
        budget.reserve
            .mockResolvedValueOnce('reserved')
            .mockResolvedValue('exhausted');
        expect(await getXPosts('TSLA', MEMBER)).toEqual({ status: 'quota' });
        cache.store.clear();
        budget.reserve.mockReset();
        budget.reserve.mockResolvedValue('unavailable');
        expect(await getXPosts('TSLA', MEMBER)).toEqual({
            status: 'provider_failed',
        });
        expect(x.users).toHaveBeenCalledTimes(1);
    });

    it('계정 조회에서 예산이 차면 quota', async () => {
        budget.reserve.mockResolvedValue('exhausted');
        expect(await getXPosts('TSLA', MEMBER)).toEqual({ status: 'quota' });
        expect(x.users).not.toHaveBeenCalled();
    });

    it('큐레이션 표에 없고 위키데이터 후보도 없으면 no_known_account(하루 뒤 재시도), X는 부르지 않는다', async () => {
        wikidata.fetch.mockResolvedValue({
            companyHandles: [],
            executives: [],
        });
        expect(await getXPosts('IONQ', MEMBER)).toEqual({
            status: 'no_known_account',
        });
        expect(x.users).not.toHaveBeenCalled();
        expect(cache.writes).toEqual([
            { key: 'x:accounts:v1:IONQ', ttl: 86_400 },
        ]);
    });

    it('큐레이션 표에 없는 종목에서 위키데이터가 실패하면 provider_failed(계정 없음으로 단정하지 않는다)', async () => {
        wikidata.fetch.mockRejectedValue(new Error('wikidata responded 429'));
        expect(await getXPosts('MSFT', MEMBER)).toEqual({
            status: 'provider_failed',
        });
        expect(cache.store.size).toBe(0);
    });

    it('회사만 큐레이션된 종목에서 위키데이터가 실패하면 회사 계정만으로 진행하고 10분 뒤 다시 찾는다', async () => {
        wikidata.fetch.mockRejectedValue(new Error('down'));
        x.users.mockResolvedValue({
            users: [user('1', 'Meta', 5_000_000)],
            billedItems: 1,
        });
        x.timeline.mockResolvedValue(page([rawPost('1', 1)]));
        expect(await getXPosts('META', MEMBER)).toMatchObject({
            status: 'ok',
            accounts: [{ handle: 'Meta', role: 'company' }],
        });
        expect(cache.writes).toContainEqual({
            key: 'x:accounts:v1:META',
            ttl: 600,
        });
    });

    it('한국 주식·키 없음은 X와 예산을 건드리지 않는다', async () => {
        expect(await getXPosts('005930.KS', MEMBER)).toEqual({
            status: 'no_known_account',
        });
        x.token = null;
        expect(await getXPosts('TSLA', MEMBER)).toEqual({
            status: 'provider_failed',
        });
        expect(x.users).not.toHaveBeenCalled();
        expect(budget.reserve).not.toHaveBeenCalled();
    });

    it(`합쳐서 최대 ${AGENT_X_POSTS_MAX}건, asOf는 가장 먼저 읽은 타임라인 시각`, async () => {
        teslaUsers();
        x.timeline.mockImplementation(async (userId: string) =>
            page(
                Array.from({ length: PAGE }, (_, i) =>
                    rawPost(`${userId.slice(0, 2)}${i}`, i)
                ),
                true
            )
        );
        const before = Date.now();
        const result = await getXPosts('TSLA', MEMBER);
        if (result.status !== 'ok') throw new Error('expected ok');
        expect(result.posts).toHaveLength(AGENT_X_POSTS_MAX);
        expect(result.posts.filter(p => p.role === 'company')).toHaveLength(
            AGENT_X_POSTS_MAX / 2
        );
        expect(Date.parse(result.asOf)).toBeGreaterThanOrEqual(before - 1_000);
    });
});
