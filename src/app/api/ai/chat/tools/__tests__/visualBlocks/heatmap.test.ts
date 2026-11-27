vi.mock('server-only', () => ({}));

const m = vi.hoisted(() => ({
    summary: vi.fn(),
    names: vi.fn(),
    theme: vi.fn(),
}));
vi.mock('@/entities/market-summary/api/marketSummaryStaticCache', () => ({
    getMarketSummaryStatic: m.summary,
}));
vi.mock('@/app/api/ai/chat/tools/getMarketOverview', () => ({
    isRankableSector: (s: { price: number }) => s.price > 0,
    sectorDisplayNames: m.names,
}));
vi.mock('@/app/api/ai/chat/tools/getThemeSnapshot', () => ({
    loadThemeSnapshot: m.theme,
}));

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildHeatmapBlock } from '@/app/api/ai/chat/tools/visualBlocks/heatmap';

const env = {
    locale: 'ko' as const,
    userId: 'u',
    allowUnofficialSources: true,
    now: new Date('2026-11-19T12:00:00Z'),
};

const sector = (symbol: string, changesPercentage: number, price = 10) => ({
    symbol,
    sectorName: symbol,
    koreanName: `${symbol}-ko`,
    price,
    changesPercentage,
});

beforeEach(() => {
    Object.values(m).forEach(fn => fn.mockReset());
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

describe('buildHeatmapBlock — 섹터', () => {
    it('등락률 큰 순으로 정렬하고 시세를 못 받은 섹터는 뺀다', async () => {
        m.summary.mockResolvedValue({
            indices: [],
            sectors: [
                sector('XLK', 1.5),
                sector('XLE', -2),
                sector('XLF', 0, 0),
                sector('XLV', 3),
            ],
        });
        m.names.mockResolvedValue({
            XLK: '기술',
            XLE: '에너지',
            XLV: '헬스케어',
        });
        const out = await buildHeatmapBlock('us', null, env);
        if ('error' in out) throw new Error(out.reason);
        expect(out.block).toMatchObject({
            kind: 'heatmap',
            scope: 'sectors',
            market: 'us',
            sectors: [
                { label: '헬스케어', changePct: 3 },
                { label: '기술', changePct: 1.5 },
                { label: '에너지', changePct: -2 },
            ],
        });
    });

    it('시장 요약을 못 읽으면 no_data', async () => {
        m.summary.mockRejectedValue(new Error('fmp'));
        expect(await buildHeatmapBlock('kr', null, env)).toEqual({
            error: 'no_data',
            reason: 'no_sector_quotes',
        });
    });
});

describe('buildHeatmapBlock — 테마', () => {
    it('테마 구성 종목의 1·5·20일 등락률 블록(한국어 로케일은 한글 테마명)', async () => {
        m.theme.mockResolvedValue({
            asOf: '2026-11-19T00:00:00.000Z',
            source: 's',
            available: true,
            theme: {
                id: 'ai_semis',
                nameKo: 'AI 반도체',
                nameEn: 'AI semis',
                market: 'us',
            },
            members: [
                {
                    symbol: 'NVDA',
                    name: '엔비디아',
                    lastClose: 1,
                    lastDate: null,
                    changePct: { '1d': 2, '5d': 5, '20d': null },
                    fromHigh52wPct: null,
                },
            ],
            summary: { '1d': { avgPct: 2 } },
            missing: ['ARM'],
        });
        const out = await buildHeatmapBlock('us', 'ai_semis', env);
        if ('error' in out) throw new Error(out.reason);
        expect(out.block).toMatchObject({
            scope: 'theme',
            theme: 'ai_semis',
            label: 'AI 반도체',
            members: [
                {
                    symbol: 'NVDA',
                    changePct1d: 2,
                    changePct5d: 5,
                    changePct20d: null,
                },
            ],
        });
        expect(out.summary).toMatchObject({
            missing: ['ARM'],
            averageDayChangePct: 2,
        });
    });

    it('모르는 테마는 invalid_args, 시세를 못 읽으면 no_data', async () => {
        expect(await buildHeatmapBlock('us', 'nope', env)).toMatchObject({
            error: 'invalid_args',
        });
        expect(m.theme).not.toHaveBeenCalled();
        m.theme.mockResolvedValue({
            theme: 'quantum',
            available: false,
            reason: 'provider_failed',
        });
        expect(await buildHeatmapBlock('us', 'quantum', env)).toMatchObject({
            error: 'no_data',
        });
    });
});
