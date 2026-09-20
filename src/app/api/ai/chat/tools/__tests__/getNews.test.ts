import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { bySymbol, byCategory, peekDigest, degradeSpy } = vi.hoisted(() => ({
    bySymbol: vi.fn(),
    byCategory: vi.fn(),
    peekDigest: vi.fn(),
    degradeSpy: vi.fn(),
}));
vi.mock('@/entities/news-article/api', () => ({
    DrizzleNewsRepository: vi.fn(function () {
        return { listCardsBySymbol: bySymbol };
    }),
}));
vi.mock('@/entities/market-news/api', () => ({
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
vi.mock('@/app/api/ai/chat/tools/logToolDegrade', () => ({
    logToolDegrade: degradeSpy,
}));

import { getNewsTool } from '@/app/api/ai/chat/tools/getNews';
import { MS_PER_DAY } from '@/shared/config/time';
import {
    TOOL_RESULT_MAX_CHARS,
    truncateToolResult,
} from '@/app/api/ai/chat/tools/truncate';

const ctx = {
    userId: 'u',
    tier: 'member' as const,
    locale: 'ko' as const,
    signal: new AbortController().signal,
};
const rt = { analysisModel: 'deepseek-v4.1-flash' as const };
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
        // 기본은 캐시 미스 — 다이제스트를 기대하는 테스트만 값을 넣는다.
        peekDigest.mockResolvedValue(null);
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
            TOOL_RESULT_MAX_CHARS
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
            TOOL_RESULT_MAX_CHARS
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
            TOOL_RESULT_MAX_CHARS
        );
        expect(truncateToolResult(r)).not.toMatchObject({ truncated: true });
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
