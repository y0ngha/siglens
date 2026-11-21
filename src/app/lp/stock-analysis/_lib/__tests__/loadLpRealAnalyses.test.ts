const { mockGetSeoSnapshotsStatic } = vi.hoisted(() => ({
    mockGetSeoSnapshotsStatic: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/entities/seo-snapshot/server/getSnapshotStatic', () => ({
    getSeoSnapshotsStatic: mockGetSeoSnapshotsStatic,
}));

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SeoAnalysisSnapshot } from '@/entities/seo-snapshot/model';
import { LP_ANALYSIS_SUBJECTS } from '@/views/lp/lib/stockAnalysisContent';
import { loadLpRealAnalyses } from '../loadLpRealAnalyses';

const GENERATED_AT = new Date('2026-11-20T01:12:00.000Z');

function technicalRow(symbol: string): SeoAnalysisSnapshot {
    return {
        symbol,
        tab: 'technical',
        locale: 'ko',
        content: {
            summary: '요약입니다.',
            trend: 'bullish',
            dataAsOf: {
                barTime: Date.UTC(2026, 10, 19, 5, 0, 0) / 1000,
                close: 100,
            },
        },
        plain: '문단입니다.',
        model: 'm',
        generatedAt: GENERATED_AT,
        firstGeneratedAt: null,
        updatedAt: GENERATED_AT,
    };
}

function callFor(symbol: string) {
    return mockGetSeoSnapshotsStatic.mock.calls.find(
        call => call[0] === symbol
    );
}

describe('loadLpRealAnalyses', () => {
    beforeEach(() => {
        mockGetSeoSnapshotsStatic.mockReset();
    });

    it('reads each subject once with the page revalidate and the ko locale', async () => {
        mockGetSeoSnapshotsStatic.mockResolvedValue([]);
        await loadLpRealAnalyses(21600);
        expect(mockGetSeoSnapshotsStatic).toHaveBeenCalledTimes(
            LP_ANALYSIS_SUBJECTS.length
        );
        LP_ANALYSIS_SUBJECTS.forEach(({ symbol }) => {
            expect(callFor(symbol)).toEqual([symbol, 21600, 'ko']);
        });
    });

    it('returns [] when every read degrades to null', async () => {
        mockGetSeoSnapshotsStatic.mockResolvedValue(null);
        expect(await loadLpRealAnalyses(21600)).toEqual([]);
    });

    it('returns [] when rows exist only for other tabs', async () => {
        mockGetSeoSnapshotsStatic.mockImplementation(async (symbol: string) => [
            { ...technicalRow(symbol), tab: 'news' },
        ]);
        expect(await loadLpRealAnalyses(21600)).toEqual([]);
    });

    it('omits a subject without a row and keeps subject order', async () => {
        mockGetSeoSnapshotsStatic.mockImplementation(async (symbol: string) =>
            symbol === 'NVDA' ? [technicalRow('NVDA')] : []
        );
        const cards = await loadLpRealAnalyses(21600);
        expect(cards.map(card => card.symbol)).toEqual(['NVDA']);
    });

    it('returns every card in subject order', async () => {
        mockGetSeoSnapshotsStatic.mockImplementation(async (symbol: string) => [
            technicalRow(symbol),
        ]);
        const cards = await loadLpRealAnalyses(21600);
        expect(cards.map(card => card.symbol)).toEqual(
            LP_ANALYSIS_SUBJECTS.map(subject => subject.symbol)
        );
    });
});
