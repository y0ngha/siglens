import { describe, expect, it, vi } from 'vitest';

const { bySymbol, byCategory } = vi.hoisted(() => ({
    bySymbol: vi.fn(),
    byCategory: vi.fn(),
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
    it('카테고리 slug → sentinel 매핑', async () => {
        byCategory.mockResolvedValue([row(1)]);
        await getNewsTool({ category: 'crypto' }, ctx, rt);
        expect(byCategory).toHaveBeenCalledWith(
            '__NEWS_CRYPTO__',
            expect.any(Number),
            'ko'
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

    it('since가 유효하지 않은 날짜면 invalid_args (item 5)', async () => {
        expect(
            await getNewsTool({ symbol: 'AAPL', since: 'not-a-date' }, ctx, rt)
        ).toMatchObject({ error: 'invalid_args' });
        expect(bySymbol).not.toHaveBeenCalled();
    });

    it('오래된 since는 30일로 클램프된다 (item 5)', async () => {
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

    it('locale이 ja면 사이드카 titleLocalized를 우선한다 (item 7)', async () => {
        bySymbol.mockResolvedValue([
            { ...row(1), titleLocalized: 'ニュース1' },
        ]);
        const jaCtx = { ...ctx, locale: 'ja' as const };
        const r = (await getNewsTool({ symbol: 'AAPL' }, jaCtx, rt)) as {
            items: Array<{ title: string }>;
        };
        expect(r.items[0]!.title).toBe('ニュース1');
    });

    it('locale이 en이고 사이드카가 없으면 titleEn으로 폴백한다 (item 7)', async () => {
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
});
