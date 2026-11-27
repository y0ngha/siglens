const { bySymbol, byCategory, peekDigest, degradeSpy, getBars, profile } =
    vi.hoisted(() => ({
        bySymbol: vi.fn(),
        byCategory: vi.fn(),
        peekDigest: vi.fn(),
        degradeSpy: vi.fn(),
        getBars: vi.fn(),
        profile: vi.fn(),
    }));
vi.mock('@/entities/news-article/api', () => ({
    DrizzleNewsRepository: vi.fn(function () {
        return { listCardsBySymbol: bySymbol };
    }),
}));
vi.mock('@/entities/market-news/api/marketNewsRepository', () => ({
    DrizzleMarketNewsRepository: vi.fn(function () {
        return { listCardsByCategory: byCategory };
    }),
}));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: () => ({ db: {} }),
}));
vi.mock('@/entities/market-news/api/marketNewsDigestStaticCache', () => ({
    peekMarketNewsDigestStatic: peekDigest,
}));
vi.mock('@/shared/lib/logToolDegrade', () => ({
    logToolDegrade: degradeSpy,
}));
vi.mock('@/entities/bars/server/barsDataCache', () => ({
    getCachedBarsWithIndicators: getBars,
}));
vi.mock('@/entities/ticker/lib/resolveMarketProfile', () => ({
    resolveMarketProfile: profile,
}));
vi.mock('@/shared/api/market/getCachedMarketDataProvider', () => ({
    getCachedMarketDataProvider: () => ({}),
}));
vi.mock('@/entities/ticker/server/resolveAssetInfo', () => ({
    resolveAssetInfoOrNull: async () => null,
}));

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    NEWS_RESULT_MAX_CHARS,
    truncateToolResult,
} from '@/features/agent-tools/lib/truncate';
import {
    getNewsTool,
    resolveNewsWindow,
} from '@/features/agent-tools/server/tools/getNews';
import { MS_PER_DAY } from '@/shared/config/time';

const ctx = {
    userId: 'u',
    tier: 'member' as const,
    locale: 'ko' as const,
    signal: new AbortController().signal,
};
const ensureSymbolData = vi.fn(async (): Promise<void> => {});
const rt = {
    analysisModel: 'deepseek-v4.1-flash' as const,
    ensureSymbolData,
};
const row = (i: number) => ({
    titleEn: `t${i}`,
    titleKo: `제목${i}`,
    summaryKo: `요약${i}`,
    bodyKo: 'b'.repeat(2000),
    sentiment: 'positive',
    priceImpact: 'high',
    publishedAt: '2026-09-10',
    url: `https://n/${i}`,
    source: 's',
});

describe('getNewsTool', () => {
    beforeEach(() => {
        // 호출 기록만 지운다(구현은 유지) — 이 파일에는 "호출되지 않았다"를 단언하는
        // 테스트가 있어서, 앞 테스트의 조회가 남아 있으면 그쪽이 엉뚱하게 깨진다.
        vi.clearAllMocks();
        // The symbol window is anchored on the clock; the fixtures below are dated inside it.
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-09-14T12:00:00.000Z'));
        // Default: a cached series with no sessions, so `priceMoves` is null unless a test loads bars.
        profile.mockResolvedValue('us-equity');
        getBars.mockResolvedValue({ bars: [], indicators: {} });
        // 기본은 캐시 미스 — 다이제스트를 기대하는 테스트만 값을 넣는다.
        peekDigest.mockResolvedValue(null);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('카테고리 slug → sentinel 매핑', async () => {
        byCategory.mockResolvedValue([row(1)]);
        await getNewsTool({ category: 'crypto' }, ctx, rt);
        expect(byCategory).toHaveBeenCalledWith(
            '__NEWS_CRYPTO__',
            expect.any(Number),
            'ko'
        );
    });

    it('카테고리 요청은 그 피드의 AI 다이제스트를 함께 싣고, 심볼 요청에는 싣지 않는다', async () => {
        byCategory.mockResolvedValue([row(1)]);
        bySymbol.mockResolvedValue([row(1)]);
        peekDigest.mockResolvedValue({
            currentDriverKo: '반도체 수요 회복 기대',
            keyEventsKo: ['엔비디아 실적 서프라이즈'],
            upcomingEventsKo: ['FOMC'],
            overallSentiment: 'positive',
        });

        const byCat = (await getNewsTool({ category: 'crypto' }, ctx, rt)) as {
            digest: { driver: string; overallSentiment: string } | null;
        };
        expect(peekDigest).toHaveBeenCalledWith('crypto', 'ko');
        expect(byCat.digest).toEqual({
            driver: '반도체 수요 회복 기대',
            keyEvents: ['엔비디아 실적 서프라이즈'],
            upcomingEvents: ['FOMC'],
            overallSentiment: 'positive',
        });

        // 다이제스트는 카테고리 단위다 — 심볼 질의에 붙이면 다른 종목 이야기가 섞인다.
        peekDigest.mockClear();
        const bySym = (await getNewsTool({ symbol: 'AAPL' }, ctx, rt)) as {
            digest: unknown;
        };
        expect(peekDigest).not.toHaveBeenCalled();
        expect(bySym.digest).toBeNull();
    });

    // peek 구현은 지금 자체 try/catch로 실패를 삼키지만, 그 계약이 바뀌면
    // `Promise.all`의 형제가 통째로 무너져 기사 목록까지 잃는다 — 이 테스트는
    // 그 경계가 유지되는지를 고정한다.
    it('다이제스트 peek이 실패해도 뉴스 목록은 그대로 나가고, 실패는 로그로 남는다', async () => {
        byCategory.mockResolvedValue([row(1)]);
        peekDigest.mockRejectedValue(new Error('redis down'));
        degradeSpy.mockClear();
        const r = (await getNewsTool({ category: 'crypto' }, ctx, rt)) as {
            digest: unknown;
            items: unknown[];
        };
        expect(r.digest).toBeNull();
        expect(r.items).toHaveLength(1);
        expect(degradeSpy).toHaveBeenCalledWith(
            'get_news',
            'digest peek',
            expect.any(Error)
        );
    });

    it('symbol·category 둘 다 없거나 미지 카테고리 → invalid_args', async () => {
        expect(await getNewsTool({}, ctx, rt)).toMatchObject({
            error: 'invalid_args',
        });
        expect(await getNewsTool({ category: 'nope' }, ctx, rt)).toMatchObject({
            error: 'invalid_args',
        });
    });

    it('since가 유효하지 않은 날짜면 invalid_args', async () => {
        expect(
            await getNewsTool({ symbol: 'AAPL', since: 'not-a-date' }, ctx, rt)
        ).toMatchObject({ error: 'invalid_args' });
        expect(bySymbol).not.toHaveBeenCalled();
    });

    it('오래된 since는 30일로 클램프된다', async () => {
        bySymbol.mockResolvedValue([]);
        await getNewsTool({ symbol: 'AAPL', since: '2000-01-01' }, ctx, rt);
        const sinceMsArg = bySymbol.mock.calls[0]![1] as number;
        expect(sinceMsArg).toBeLessThanOrEqual(30 * MS_PER_DAY);
    });

    it('query 필터·limit·includeBody 3건·ko 제목, 본문이 예산 내로 들어온다', async () => {
        bySymbol.mockResolvedValue([
            row(1),
            row(2),
            row(3),
            row(4),
            { ...row(5), titleKo: 'ZZZ' },
        ]);
        const r = (await getNewsTool(
            { symbol: 'aapl', query: '제목', limit: 4, includeBody: true },
            ctx,
            rt
        )) as {
            items: Array<{ title: string; body?: string }>;
        };
        expect(r.items).toHaveLength(4);
        expect(r.items[0]!.title).toBe('제목1');
        expect(r.items.filter(i => i.body).length).toBe(3);
        expect(JSON.stringify(r).length).toBeLessThanOrEqual(
            NEWS_RESULT_MAX_CHARS
        );
        expect(bySymbol).toHaveBeenCalledWith('AAPL', expect.any(Number), 'ko');
    });

    it('빈 결과는 coverageLimited', async () => {
        bySymbol.mockResolvedValue([]);
        expect(await getNewsTool({ symbol: 'AAPL' }, ctx, rt)).toMatchObject({
            count: 0,
            coverageLimited: true,
        });
    });

    it('locale이 en이면 titleEn을 쓴다', async () => {
        bySymbol.mockResolvedValue([row(1)]);
        const enCtx = { ...ctx, locale: 'en' as const };
        const r = (await getNewsTool({ symbol: 'AAPL' }, enCtx, rt)) as {
            items: Array<{ title: string }>;
        };
        expect(r.items[0]!.title).toBe('t1');
    });

    it('locale이 ja면 사이드카 titleLocalized를 우선한다', async () => {
        bySymbol.mockResolvedValue([
            { ...row(1), titleLocalized: 'ニュース1' },
        ]);
        const jaCtx = { ...ctx, locale: 'ja' as const };
        const r = (await getNewsTool({ symbol: 'AAPL' }, jaCtx, rt)) as {
            items: Array<{ title: string }>;
        };
        expect(r.items[0]!.title).toBe('ニュース1');
    });

    it('locale이 en이고 사이드카가 없으면 titleEn으로 폴백한다', async () => {
        bySymbol.mockResolvedValue([row(1)]);
        const enCtx = { ...ctx, locale: 'en' as const };
        const r = (await getNewsTool(
            { symbol: 'AAPL', includeBody: true },
            enCtx,
            rt
        )) as { items: Array<{ title: string; body?: string }> };
        expect(r.items[0]!.title).toBe('t1');
        // No sidecar body translation on this fixture → falls back to bodyKo,
        // still budgeted to fit under the tool result cap.
        expect(JSON.stringify(r).length).toBeLessThanOrEqual(
            NEWS_RESULT_MAX_CHARS
        );
    });

    it('따옴표·줄바꿈이 많은 본문도 JSON 이스케이프 후 예산을 넘지 않는다', async () => {
        // Raw-length budgeting under-counts: every `"` and newline grows by one
        // char in JSON, so an escape-heavy body overflows and the registry
        // collapses the whole payload into a preview blob.
        const escapeHeavy = '그는 "인용"을 말했다.\n'.repeat(400);
        bySymbol.mockResolvedValue([
            { ...row(1), bodyKo: escapeHeavy },
            { ...row(2), bodyKo: escapeHeavy },
            { ...row(3), bodyKo: escapeHeavy },
        ]);
        const r = await getNewsTool(
            { symbol: 'AAPL', includeBody: true },
            ctx,
            rt
        );
        expect(JSON.stringify(r).length).toBeLessThanOrEqual(
            NEWS_RESULT_MAX_CHARS
        );
        expect(truncateToolResult(r, NEWS_RESULT_MAX_CHARS)).not.toMatchObject({
            truncated: true,
        });
    });

    it('모델이 준 limit은 1..20으로 제한되고 숫자가 아니면 기본값', async () => {
        bySymbol.mockResolvedValue(
            Array.from({ length: 30 }, (_, i) => row(i + 1))
        );
        const count = async (limit: unknown) =>
            (
                (await getNewsTool({ symbol: 'AAPL', limit }, ctx, rt)) as {
                    items: unknown[];
                }
            ).items.length;
        // Numbers are pinned into 1..MAX; only a non-number falls back to 5.
        expect(await count(-1)).toBe(1);
        expect(await count(0)).toBe(1);
        expect(await count(Number.NaN)).toBe(5);
        expect(await count('3')).toBe(5);
        expect(await count(999)).toBe(20);
    });

    describe('tally/ageHours (spec §3.7, B9)', () => {
        beforeEach(() => {
            vi.useFakeTimers();
            vi.setSystemTime(new Date('2026-09-14T12:00:00.000Z'));
        });
        afterEach(() => {
            vi.useRealTimers();
        });

        it('반환된 items 기준으로 tally를 센다', async () => {
            bySymbol.mockResolvedValue([
                { ...row(1), sentiment: 'bullish', priceImpact: 'high' },
                { ...row(2), sentiment: 'bullish', priceImpact: 'low' },
                { ...row(3), sentiment: 'bearish', priceImpact: 'high' },
                { ...row(4), sentiment: 'neutral', priceImpact: 'medium' },
            ]);
            const r = (await getNewsTool({ symbol: 'AAPL' }, ctx, rt)) as {
                tally: {
                    bullish: number;
                    bearish: number;
                    neutral: number;
                    highImpact: number;
                };
            };
            expect(r.tally).toEqual({
                bullish: 2,
                bearish: 1,
                neutral: 1,
                highImpact: 2,
            });
        });

        it('limit으로 잘린 뒤의 items만 tally에 들어간다', async () => {
            bySymbol.mockResolvedValue([
                { ...row(1), sentiment: 'bullish', priceImpact: 'low' },
                { ...row(2), sentiment: 'bearish', priceImpact: 'low' },
            ]);
            const r = (await getNewsTool(
                { symbol: 'AAPL', limit: 1 },
                ctx,
                rt
            )) as { tally: { bullish: number; bearish: number } };
            expect(r.tally).toMatchObject({ bullish: 1, bearish: 0 });
        });

        it('ageHours: publishedAt으로부터 경과 시간(시간 단위, 반올림)', async () => {
            bySymbol.mockResolvedValue([
                { ...row(1), publishedAt: '2026-09-14T09:00:00.000Z' }, // 3h ago
            ]);
            const r = (await getNewsTool({ symbol: 'AAPL' }, ctx, rt)) as {
                items: Array<{ ageHours: number | null }>;
            };
            expect(r.items[0]!.ageHours).toBe(3);
        });

        it('publishedAt이 파싱 불가하면 ageHours는 null (null rule)', async () => {
            bySymbol.mockResolvedValue([
                { ...row(1), publishedAt: 'not-a-date' },
            ]);
            const r = (await getNewsTool({ symbol: 'AAPL' }, ctx, rt)) as {
                items: Array<{ ageHours: number | null }>;
            };
            expect(r.items[0]!.ageHours).toBeNull();
        });
    });
});

const DAY_MS = MS_PER_DAY;

/** Daily bar stamped at UTC midnight of its trading date, like the cached series. */
const dayBar = (date: string, close: number) => ({
    time: Date.parse(`${date}T00:00:00Z`) / 1000,
    open: close,
    high: close,
    low: close,
    close,
    volume: 1,
});

/** Weekday dates from `from` to `to` inclusive (UTC calendar), minus `skip`. */
const weekdays = (from: string, to: string, skip: string[] = []): string[] =>
    Array.from(
        {
            length:
                Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS) + 1,
        },
        (_, i) => new Date(Date.parse(from) + i * DAY_MS)
    )
        .filter(d => d.getUTCDay() !== 0 && d.getUTCDay() !== 6)
        .map(d => d.toISOString().slice(0, 10))
        .filter(d => !skip.includes(d));

const US_CLOSE_OVERRIDES: Record<string, number> = {
    '2026-08-24': 90,
    '2026-08-25': 99,
};
/**
 * US sessions 2026-08-10 .. 2026-09-11 (Labor Day 09-07 absent), every close 100 except 08-24 = 90 and
 * 08-25 = 99. Changes by hand: 08-24 -10%, 08-25 +10% (99/90), 08-26 +1.01% (100/99), every other session 0.
 */
const usBars = () =>
    weekdays('2026-08-10', '2026-09-11', ['2026-09-07']).map(d =>
        dayBar(d, US_CLOSE_OVERRIDES[d] ?? 100)
    );

type PriceMovesView = {
    window: { from: string; to: string; sessions: number };
    medianAbsDailyChangePct: number | null;
    moveDays: Array<{
        date: string;
        changePct: number;
        headlines: Array<{ title: string; publishedAt: string }>;
        moreHeadlines: number;
    }>;
    afterLastClose: number;
} | null;

describe('get_news 가격 움직임 정렬 (priceMoves, session)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers({ toFake: ['Date'] });
        // Monday 08:00 ET: the US session is closed, so no bar is forming.
        vi.setSystemTime(new Date('2026-09-14T12:00:00.000Z'));
        peekDigest.mockResolvedValue(null);
        profile.mockResolvedValue('us-equity');
        getBars.mockResolvedValue({ bars: usBars(), indicators: {} });
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    const call = async (args: Record<string, unknown>) =>
        (await getNewsTool({ symbol: 'AAPL', ...args }, ctx, rt)) as {
            items: Array<{ title: string; session?: string | null }>;
            priceMoves?: PriceMovesView;
            count: number;
        };

    // Rows newest first, like the repository returns them.
    const rows = [
        // Saturday after the last close (Fri 09-11) -> no session.
        {
            ...row(1),
            titleKo: '주말 소식',
            publishedAt: '2026-09-12T15:00:00.000Z',
        },
        // Mon 08-24 17:00 ET (after the close) -> belongs to the next session, 08-25.
        {
            ...row(2),
            titleKo: '장 마감 후',
            publishedAt: '2026-08-24T21:00:00.000Z',
        },
        // Mon 08-24 10:00 ET (before the close) -> 08-24.
        {
            ...row(3),
            titleKo: '장중 소식',
            publishedAt: '2026-08-24T14:00:00.000Z',
        },
    ];

    it('attaches the largest daily moves with the headlines of their sessions, drawn from the whole window', async () => {
        bySymbol.mockResolvedValue(rows);
        // limit 1: the page holds only the newest item, but move-day headlines come from every row.
        const r = await call({ limit: 1 });
        expect(r.items).toHaveLength(1);
        expect(r.priceMoves).toMatchObject({
            // window opens at the first session on/after 2026-08-15 (a Saturday): Monday 08-17.
            window: { from: '2026-08-17', to: '2026-09-11', sessions: 19 },
            // 19 sessions, only three with a non-zero change: the median |change| is 0.
            medianAbsDailyChangePct: 0,
            afterLastClose: 1,
        });
        // |10| ties on 08-24 and 08-25: the later date ranks first; 08-26 (+1.01%) is third.
        expect(r.priceMoves?.moveDays.map(d => [d.date, d.changePct])).toEqual([
            ['2026-08-25', 10],
            ['2026-08-24', -10],
            ['2026-08-26', 1.01],
        ]);
        expect(r.priceMoves?.moveDays[0]?.headlines).toMatchObject([
            { title: '장 마감 후' },
        ]);
        expect(r.priceMoves?.moveDays[1]?.headlines).toMatchObject([
            { title: '장중 소식' },
        ]);
        expect(r.priceMoves?.moveDays[0]?.moreHeadlines).toBe(0);
    });

    it('clamps a very long headline in the items and in priceMoves so the fit can never exceed the cap', async () => {
        const long = '긴제목'.repeat(2_000);
        bySymbol.mockResolvedValue([
            {
                ...row(1),
                titleKo: long,
                publishedAt: '2026-08-24T14:00:00.000Z',
            },
        ]);
        const r = await call({});
        expect(r.items[0]?.title.length).toBeLessThanOrEqual(200);
        expect(
            r.priceMoves?.moveDays
                .flatMap(d => d.headlines)
                .map(h => h.title.length)
        ).toEqual([r.items[0]?.title.length]);
        expect(JSON.stringify(r).length).toBeLessThanOrEqual(8_000);
    });

    it('tags each item with its session (null = published after the last completed close)', async () => {
        bySymbol.mockResolvedValue(rows);
        const r = await call({ limit: 3 });
        expect(r.items.map(i => [i.title, i.session])).toEqual([
            ['주말 소식', null],
            ['장 마감 후', '2026-08-25'],
            ['장중 소식', '2026-08-24'],
        ]);
    });

    it('does not carry a session key at all when priceMoves is null (a null there would read as after the last close)', async () => {
        getBars.mockRejectedValue(new Error('bars down'));
        bySymbol.mockResolvedValue(rows);
        const r = await call({});
        expect(r.priceMoves).toBeNull();
        expect(r.count).toBe(3);
        expect(r.items.every(i => !('session' in i))).toBe(true);
        expect(degradeSpy).toHaveBeenCalledWith(
            'get_news',
            'price moves',
            expect.any(Error)
        );
    });

    it('priceMoves is null (and items carry no session) with fewer than 2 sessions in the window', async () => {
        getBars.mockResolvedValue({
            bars: [dayBar('2026-08-14', 100), dayBar('2026-08-17', 101)],
            indicators: {},
        });
        bySymbol.mockResolvedValue(rows);
        const r = await call({});
        // 08-14 is before the window (opens 08-15), so only 08-17 is in it: one session.
        expect(r.priceMoves).toBeNull();
        expect(r.items.every(i => !('session' in i))).toBe(true);
    });

    it('opens the window on the zone date of the same instant the since filter uses, so no kept item falls before it', async () => {
        // Default window: cutoff = 2026-08-15T12:00Z (08:00 ET Saturday). One row 1h before it is filtered
        // out; one 1h after it is kept and lands on the first window session (Monday 08-17).
        bySymbol.mockResolvedValue([
            {
                ...row(1),
                titleKo: '경계 직후',
                publishedAt: '2026-08-15T13:00:00.000Z',
            },
            {
                ...row(2),
                titleKo: '경계 직전',
                publishedAt: '2026-08-15T11:00:00.000Z',
            },
        ]);
        const r = await call({ limit: 5 });
        expect(r.items.map(i => [i.title, i.session])).toEqual([
            ['경계 직후', '2026-08-17'],
        ]);
        expect(r.priceMoves?.window.from).toBe('2026-08-17');
    });

    it('a date-only since is that calendar day in the market zone: the US window starts on the date, not the evening before', async () => {
        // now = 2026-09-14T12:00Z. since 2026-09-10 -> rows from 00:00 ET on 09-10 (04:00Z), window opens
        // at the 09-10 session. `Date.parse` alone would read UTC midnight = 20:00 ET on 09-09 and pull in the
        // 09-09 session and its evening headlines.
        bySymbol.mockResolvedValue([
            {
                ...row(1),
                titleKo: '수요일 밤',
                publishedAt: '2026-09-10T03:00:00.000Z', // 23:00 ET on 09-09: before the period
            },
            {
                ...row(2),
                titleKo: '목요일 새벽',
                publishedAt: '2026-09-10T05:00:00.000Z', // 01:00 ET on 09-10
            },
        ]);
        const r = await call({ since: '2026-09-10' });
        expect(r.priceMoves?.window.from).toBe('2026-09-10');
        expect(r.items.map(i => [i.title, i.session])).toEqual([
            ['목요일 새벽', '2026-09-10'],
        ]);
        // the DB read reaches back exactly to the local midnight (04:00Z), not to UTC midnight
        const [, sinceMs] =
            bySymbol.mock.calls.find(c => c[0] === 'AAPL') ?? [];
        expect(sinceMs).toBe(
            Date.parse('2026-09-14T12:00:00Z') -
                Date.parse('2026-09-10T04:00:00Z')
        );
    });

    it('a date-only since for a Korean stock keeps the pre-open headlines of that date (KST midnight is before UTC midnight)', async () => {
        profile.mockResolvedValue('kr-equity');
        bySymbol.mockResolvedValue([
            {
                ...row(1),
                titleKo: '개장 전 소식',
                publishedAt: '2026-09-09T20:00:00.000Z', // 05:00 KST on 09-10: pre-open
            },
            {
                ...row(2),
                titleKo: '전날 밤',
                publishedAt: '2026-09-09T14:00:00.000Z', // 23:00 KST on 09-09: before the period
            },
        ]);
        const r = await call({ symbol: '005930.KS', since: '2026-09-10' });
        // the 09-10 session itself (KRX closes 15:30 KST), not the one before
        expect(r.priceMoves?.window.from).toBe('2026-09-10');
        expect(r.items.map(i => [i.title, i.session])).toEqual([
            ['개장 전 소식', '2026-09-10'],
        ]);
        // KST midnight = 15:00Z on 09-09, nine hours BEFORE the UTC midnight `Date.parse` would use
        const [, sinceMs] =
            bySymbol.mock.calls.find(c => c[0] === '005930.KS') ?? [];
        expect(sinceMs).toBe(
            Date.parse('2026-09-14T12:00:00Z') -
                Date.parse('2026-09-09T15:00:00Z')
        );
    });

    it('an ISO-instant since keeps the instant and opens the window on its zone date', async () => {
        bySymbol.mockResolvedValue([
            {
                ...row(1),
                titleKo: '이후',
                publishedAt: '2026-09-10T05:00:00.000Z',
            },
            {
                ...row(2),
                titleKo: '이전',
                publishedAt: '2026-09-10T03:00:00.000Z',
            },
        ]);
        // 2026-09-10T04:00Z = 00:00 ET: the instant is kept as given
        const r = await call({ since: '2026-09-10T04:00:00Z' });
        expect(r.items.map(i => i.title)).toEqual(['이후']);
        expect(r.priceMoves?.window.from).toBe('2026-09-10');
    });

    it('a forming (live) bar is not a completed session', async () => {
        // Monday 11:00 ET: the regular session is open and the series ends with today's live bar.
        vi.setSystemTime(new Date('2026-09-14T15:00:00.000Z'));
        getBars.mockResolvedValue({
            bars: [...usBars(), dayBar('2026-09-14', 50)],
            indicators: {},
        });
        bySymbol.mockResolvedValue(rows);
        const r = await call({});
        expect(r.priceMoves?.window.to).toBe('2026-09-11');
    });

    it('crypto uses the always-open session: a headline belongs to its own UTC date', async () => {
        profile.mockResolvedValue('crypto');
        // Daily bars through 09-13 (every day, weekends included), 100 -> 100.
        getBars.mockResolvedValue({
            bars: Array.from({ length: 44 }, (_, i) =>
                dayBar(
                    new Date(Date.parse('2026-08-01') + i * DAY_MS)
                        .toISOString()
                        .slice(0, 10),
                    100 + i
                )
            ),
            indicators: {},
        });
        bySymbol.mockResolvedValue([
            { ...row(1), publishedAt: '2026-09-12T23:30:00.000Z' },
        ]);
        const r = await call({ symbol: 'BTCUSD' });
        // A scheduled US spec would find no completed session for a Saturday headline (null).
        expect(r.items[0]?.session).toBe('2026-09-12');
    });

    it('uses the defaults: 30 days for a symbol, 14 days for a category', async () => {
        bySymbol.mockResolvedValue([]);
        byCategory.mockResolvedValue([]);
        await call({});
        expect(bySymbol).toHaveBeenCalledWith('AAPL', 30 * DAY_MS, 'ko');
        await getNewsTool({ category: 'crypto' }, ctx, rt);
        expect(byCategory).toHaveBeenCalledWith(
            '__NEWS_CRYPTO__',
            14 * DAY_MS,
            'ko'
        );
    });

    it('a category result has neither priceMoves nor session', async () => {
        byCategory.mockResolvedValue([row(1)]);
        const r = (await getNewsTool({ category: 'crypto' }, ctx, rt)) as {
            items: Array<Record<string, unknown>>;
        };
        expect(r).not.toHaveProperty('priceMoves');
        expect(r.items[0]).not.toHaveProperty('session');
        expect(getBars).not.toHaveBeenCalled();
    });
});

describe('get_news 결과 크기 자체 조정', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-09-14T12:00:00.000Z'));
        peekDigest.mockResolvedValue(null);
        profile.mockResolvedValue('us-equity');
        getBars.mockResolvedValue({ bars: [], indicators: {} });
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    const koSummary = (i: number, chars: number) =>
        `요약${i} `.padEnd(chars, '가나다라마바사 ');

    it('a live-shape result (10 items, ~400-char Korean summaries, includeBody) fits the news cap and is never the truncation envelope', async () => {
        bySymbol.mockResolvedValue(
            Array.from({ length: 10 }, (_, i) => ({
                ...row(i + 1),
                summaryKo: koSummary(i + 1, 400),
            }))
        );
        const r = (await getNewsTool(
            { symbol: 'AAPL', limit: 10, includeBody: true },
            ctx,
            rt
        )) as Record<string, unknown> & { items: Array<{ summary: string }> };
        expect(r.truncated).toBeUndefined();
        expect(JSON.stringify(r).length).toBeLessThanOrEqual(
            NEWS_RESULT_MAX_CHARS
        );
        expect(truncateToolResult(r, NEWS_RESULT_MAX_CHARS)).not.toMatchObject({
            truncated: true,
        });
        expect(r.items).toHaveLength(10);
        expect(r).not.toHaveProperty('itemsTrimmed');
    });

    it('shortens summaries before dropping any item (no itemsTrimmed when shortening is enough)', async () => {
        bySymbol.mockResolvedValue(
            Array.from({ length: 20 }, (_, i) => ({
                ...row(i + 1),
                summaryKo: koSummary(i + 1, 600),
            }))
        );
        const r = (await getNewsTool(
            { symbol: 'AAPL', limit: 20 },
            ctx,
            rt
        )) as { items: Array<{ summary: string }>; count: number };
        expect(r.count).toBe(20);
        expect(r).not.toHaveProperty('itemsTrimmed');
        expect(r.items.every(i => i.summary.length <= 100)).toBe(true);
        expect(JSON.stringify(r).length).toBeLessThanOrEqual(
            NEWS_RESULT_MAX_CHARS
        );
    });

    it('drops the OLDEST items when shortened summaries still overflow; itemsTrimmed counts them and priceMoves covers the full list', async () => {
        getBars.mockResolvedValue({ bars: usBars(), indicators: {} });
        const long = Array.from({ length: 20 }, (_, i) => ({
            ...row(i + 1),
            summaryKo: koSummary(i + 1, 600),
            url: `https://n/${i + 1}/${'u'.repeat(380)}`,
            // newest first; the OLDEST row (index 19) is the 08-24 intraday headline
            publishedAt: `2026-09-${String(11 - Math.min(i, 9)).padStart(2, '0')}T14:00:00.000Z`,
        }));
        const oldest = {
            ...row(20),
            summaryKo: koSummary(20, 600),
            url: `https://n/20/${'u'.repeat(380)}`,
            titleKo: '가장 오래된 소식',
            publishedAt: '2026-08-24T14:00:00.000Z',
        };
        bySymbol.mockResolvedValue([...long.slice(0, 19), oldest]);
        const r = (await getNewsTool(
            { symbol: 'AAPL', limit: 20 },
            ctx,
            rt
        )) as {
            items: Array<{ title: string; summary: string }>;
            count: number;
            itemsTrimmed?: number;
            tally: { bullish: number; bearish: number; neutral: number };
            priceMoves: PriceMovesView;
        };
        expect(r.itemsTrimmed).toBeGreaterThan(0);
        expect(r.count + (r.itemsTrimmed ?? 0)).toBe(20);
        expect(r.items).toHaveLength(r.count);
        // The kept items are the newest ones, in order; the oldest is gone.
        expect(r.items.map(i => i.title)).toEqual(
            Array.from({ length: r.count }, (_, i) => `제목${i + 1}`)
        );
        expect(r.items.every(i => i.summary.length <= 100)).toBe(true);
        expect(JSON.stringify(r).length).toBeLessThanOrEqual(
            NEWS_RESULT_MAX_CHARS
        );
        // tally covers the returned items only.
        expect(
            r.tally.bullish + r.tally.bearish + r.tally.neutral
        ).toBeLessThanOrEqual(r.count);
        // priceMoves was built before trimming: the dropped oldest headline still sits under its move day.
        expect(
            r.priceMoves?.moveDays
                .find(d => d.date === '2026-08-24')
                ?.headlines.map(h => h.title)
        ).toEqual(['가장 오래된 소식']);
    });

    it('does not set itemsTrimmed when nothing overflows', async () => {
        bySymbol.mockResolvedValue([row(1), row(2)]);
        const r = await getNewsTool({ symbol: 'AAPL' }, ctx, rt);
        expect(r).not.toHaveProperty('itemsTrimmed');
    });
});

describe('get_news 수급 게이트', () => {
    beforeEach(() => {
        ensureSymbolData.mockClear();
        ensureSymbolData.mockImplementation(async () => {});
        bySymbol.mockResolvedValue([]);
        byCategory.mockResolvedValue([]);
    });

    /**
     * 이 툴은 DB만 읽는다. 적재를 트리거하는 다른 경로(뉴스 탭 방문·prewarm
     * cron)가 최근에 안 돌았으면 며칠 묵은 목록이 그대로 답이 된다 —
     * 실측(2026-09-21): 당일 보도자료가 FMP에는 있는데 챗은 "최신이 89시간
     * 전"이라고 답했다.
     */
    it('심볼 질의는 DB를 읽기 전에 수급을 돌린다', async () => {
        const order: string[] = [];
        ensureSymbolData.mockImplementation(async () => {
            order.push('refresh');
        });
        bySymbol.mockImplementation(async () => {
            order.push('read');
            return [];
        });

        await getNewsTool({ symbol: 'laes' }, ctx, rt);

        expect(ensureSymbolData).toHaveBeenCalledWith('LAES');
        expect(order).toEqual(['refresh', 'read']);
    });

    it('카테고리 질의는 심볼 수급 대상이 아니다', async () => {
        await getNewsTool({ category: 'crypto' }, ctx, rt);

        expect(ensureSymbolData).not.toHaveBeenCalled();
    });
});

describe('resolveNewsWindow', () => {
    const NOW = Date.parse('2026-09-14T12:00:00Z');
    const DAY = 86_400_000;
    const base = { nowMs: NOW, baselineSinceMs: 30 * DAY };

    it('a date-only since opens at local midnight of that date in the zone', () => {
        expect(
            resolveNewsWindow({
                ...base,
                since: '2026-09-10',
                zone: 'America/New_York',
            })
        ).toEqual({
            cutoffMs: Date.parse('2026-09-10T04:00:00Z'),
            windowStart: '2026-09-10',
        });
        expect(
            resolveNewsWindow({
                ...base,
                since: '2026-09-10',
                zone: 'Asia/Seoul',
            })
        ).toEqual({
            cutoffMs: Date.parse('2026-09-09T15:00:00Z'),
            windowStart: '2026-09-10',
        });
        expect(
            resolveNewsWindow({ ...base, since: '2026-09-10', zone: 'UTC' })
        ).toEqual({
            cutoffMs: Date.parse('2026-09-10T00:00:00Z'),
            windowStart: '2026-09-10',
        });
    });

    it('the 30-day cap wins over an older date: the window starts on the zone date of the capped instant', () => {
        const r = resolveNewsWindow({
            ...base,
            since: '2000-01-01',
            zone: 'UTC',
        });
        expect(r.cutoffMs).toBe(NOW - 30 * DAY);
        expect(r.windowStart).toBe('2026-08-15');
    });

    it('a future date collapses to now', () => {
        const r = resolveNewsWindow({
            ...base,
            since: '2030-01-01',
            zone: 'UTC',
        });
        expect(r.cutoffMs).toBe(NOW);
        expect(r.windowStart).toBe('2026-09-14');
    });

    it('no since (the default window) or an unknown zone keeps the baseline instant', () => {
        expect(
            resolveNewsWindow({
                ...base,
                since: undefined,
                zone: 'America/New_York',
            })
        ).toEqual({ cutoffMs: NOW - 30 * DAY, windowStart: '2026-08-15' });
        expect(
            resolveNewsWindow({
                nowMs: NOW,
                baselineSinceMs: 4 * DAY,
                since: '2026-09-10',
                zone: null,
            })
        ).toEqual({ cutoffMs: NOW - 4 * DAY, windowStart: '2026-09-10' });
    });
});
