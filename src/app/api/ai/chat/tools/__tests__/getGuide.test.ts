import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GuideEntry } from '@/entities/guide/types';

const { loadGuideCatalog } = vi.hoisted(() => ({ loadGuideCatalog: vi.fn() }));
vi.mock('@/entities/guide/api', () => ({ loadGuideCatalog }));

import {
    GUIDE_BODY_MAX_CHARS,
    cutAtParagraph,
    getGuideTool,
} from '@/app/api/ai/chat/tools/getGuide';

const rt = {
    analysisModel: 'deepseek-v4.1-flash' as const,
    ensureSymbolData: async (): Promise<void> => {},
};

function ctx(locale: 'ko' | 'en' = 'ko') {
    return {
        userId: 'u',
        tier: 'member' as const,
        locale,
        signal: new AbortController().signal,
    };
}

function entry(overrides: Partial<GuideEntry>): GuideEntry {
    return {
        slug: 'rsi',
        category: 'indicators',
        order: 1,
        title: 'RSI',
        aliases: ['상대강도지수'],
        summary: '과열을 재는 지표',
        updatedAt: '2026-10-01T00:00:00.000Z',
        seoTitle: 'RSI 뜻',
        seoDescription: '설명',
        demoCaption: null,
        bodyMd: '## 본문',
        faq: [],
        related: [],
        isFallback: false,
        ...overrides,
    };
}

describe('getGuideTool', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('빈 질의는 invalid_query', async () => {
        expect(await getGuideTool({ query: '  ' }, ctx(), rt)).toEqual({
            error: 'invalid_query',
        });
        expect(await getGuideTool({}, ctx(), rt)).toEqual({
            error: 'invalid_query',
        });
        expect(loadGuideCatalog).not.toHaveBeenCalled();
    });

    it('카탈로그가 없으면 guide_unavailable', async () => {
        loadGuideCatalog.mockResolvedValue(null);
        expect(await getGuideTool({ query: 'RSI' }, ctx(), rt)).toEqual({
            found: false,
            reason: 'guide_unavailable',
        });
    });

    it('일치가 없으면 found:false', async () => {
        loadGuideCatalog.mockResolvedValue({ entries: [entry({})] });
        const result = await getGuideTool({ query: '없는개념' }, ctx(), rt);
        expect(result).toMatchObject({
            source: 'siglens-guide',
            found: false,
            others: [],
        });
    });

    it('최상위 1건만 본문을 싣고 나머지는 요약과 url만 싣는다', async () => {
        loadGuideCatalog.mockResolvedValue({
            entries: [
                entry({ slug: 'rsi', title: 'RSI', bodyMd: 'RSI 본문' }),
                entry({
                    slug: 'stochastic-rsi',
                    title: 'Stochastic RSI',
                    bodyMd: '다른 본문',
                }),
            ],
        });
        const result = (await getGuideTool({ query: 'rsi' }, ctx(), rt)) as {
            found: boolean;
            best: Record<string, unknown>;
            others: Record<string, unknown>[];
        };

        expect(result.found).toBe(true);
        expect(result.best).toMatchObject({
            title: 'RSI',
            category: 'indicators',
            body: 'RSI 본문',
            bodyTruncated: false,
            url: 'https://siglens.io/guide/indicators/rsi',
        });
        expect(result.others).toHaveLength(1);
        expect(result.others[0]).not.toHaveProperty('body');
        expect(result.others[0]).toMatchObject({
            url: 'https://siglens.io/guide/indicators/stochastic-rsi',
        });
    });

    it('비-ko 로케일은 url에 접두사를 붙이고 그 로케일 카탈로그를 읽는다', async () => {
        loadGuideCatalog.mockResolvedValue({ entries: [entry({})] });
        const result = (await getGuideTool(
            { query: 'RSI' },
            ctx('en'),
            rt
        )) as { best: { url: string } };

        expect(loadGuideCatalog).toHaveBeenCalledWith('en');
        expect(result.best.url).toBe(
            'https://siglens.io/en/guide/indicators/rsi'
        );
    });

    it('긴 본문은 문단 경계에서 3,500자 이내로 자른다', async () => {
        const paragraph = '가'.repeat(1000);
        loadGuideCatalog.mockResolvedValue({
            entries: [
                entry({
                    bodyMd: [paragraph, paragraph, paragraph, paragraph].join(
                        '\n\n'
                    ),
                }),
            ],
        });
        const result = (await getGuideTool({ query: 'RSI' }, ctx(), rt)) as {
            best: { body: string; bodyTruncated: boolean };
        };

        expect(result.best.bodyTruncated).toBe(true);
        expect(result.best.body.length).toBeLessThanOrEqual(
            GUIDE_BODY_MAX_CHARS
        );
        expect(result.best.body).toBe(
            [paragraph, paragraph, paragraph].join('\n\n')
        );
    });
});

describe('cutAtParagraph', () => {
    it('상한 이하면 그대로 돌려준다', () => {
        expect(cutAtParagraph('짧은 글', 100)).toEqual({
            text: '짧은 글',
            truncated: false,
        });
    });

    it('첫 문단이 상한보다 길면 문자 수로 자른다', () => {
        const result = cutAtParagraph('가'.repeat(50), 10);
        expect(result.text).toBe('가'.repeat(10));
        expect(result.truncated).toBe(true);
    });

    it('서로게이트 쌍 중간에서 끊지 않는다', () => {
        const result = cutAtParagraph('😀'.repeat(10), 3);
        expect(result.text).toBe('😀');
    });
});
