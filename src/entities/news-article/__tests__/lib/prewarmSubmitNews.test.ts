import type { MockedClass, Mock } from 'vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

vi.mock('@y0ngha/siglens-core', async () => {
    const actual = await vi.importActual<typeof import('@y0ngha/siglens-core')>(
        '@y0ngha/siglens-core'
    );
    return {
        ...actual,
        submitNewsAnalysis: vi.fn(),
    };
});

vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn().mockReturnValue({ db: {} }),
}));

vi.mock('@/entities/news-article/api', () => ({
    DrizzleNewsRepository: vi.fn().mockImplementation(function () {
        return { listBySymbol: vi.fn() };
    }),
}));

vi.mock('@/entities/earnings-report', () => ({
    getNextEarningsReport: vi.fn(),
}));

vi.mock('@/entities/ticker/lib/resolveAssetClass', () => ({
    resolveAssetClass: vi.fn().mockResolvedValue('equity'),
}));

import {
    submitNewsAnalysis,
    DEEPSEEK_V4_FLASH_MODEL,
    type SubmitNewsAnalysisResult,
    type EarningsCalendarItem,
} from '@y0ngha/siglens-core';
import { DrizzleNewsRepository } from '@/entities/news-article/api';
import { getNextEarningsReport } from '@/entities/earnings-report';
import { resolveAssetClass } from '@/entities/ticker/lib/resolveAssetClass';
import { prewarmNews } from '../../lib/prewarmSubmitNews';

const mockSubmitNewsAnalysis = vi.mocked(submitNewsAnalysis);
const MockNewsRepository = DrizzleNewsRepository as MockedClass<
    typeof DrizzleNewsRepository
>;
const mockGetNextEarningsReport = vi.mocked(getNextEarningsReport);
const mockResolveAssetClass = vi.mocked(resolveAssetClass);

const ANALYZED_ROW = {
    id: 'abc123',
    symbol: 'AAPL',
    source: 'Reuters',
    url: 'https://reuters.com/aapl',
    publishedAt: '2025-07-01T10:00:00.000Z',
    titleEn: 'Apple earnings beat',
    bodyEn: 'Apple reported...',
    titleKo: '애플 실적 예상치 상회',
    bodyKo: '애플이 보고했다...',
    summaryKo: '긍정적 실적 발표',
    sentiment: 'bullish',
    priceImpact: 'positive',
    category: 'earnings',
    analyzedAt: new Date('2025-07-01T11:00:00.000Z'),
};

const UNANALYZED_ROW = {
    ...ANALYZED_ROW,
    id: 'def456',
    titleKo: null,
    bodyKo: null,
    summaryKo: null,
    priceImpact: null,
    sentiment: null,
    category: null,
    analyzedAt: null,
};

const NEXT_EARNINGS: EarningsCalendarItem = {
    symbol: 'AAPL',
    earningsDate: '2025-08-01',
    epsActual: null,
    epsEstimated: 1.4,
    revenueActual: null,
    revenueEstimated: 88_000_000_000,
    lastUpdated: '2025-07-15',
};

const SUBMITTED_RESULT: SubmitNewsAnalysisResult = {
    status: 'submitted',
    jobId: 'job-news-001',
};

describe('prewarmNews', () => {
    let mockListBySymbol: Mock;

    beforeEach(() => {
        vi.clearAllMocks();
        mockSubmitNewsAnalysis.mockResolvedValue(SUBMITTED_RESULT);
        mockResolveAssetClass.mockResolvedValue('equity');
        mockGetNextEarningsReport.mockResolvedValue(null);

        mockListBySymbol = vi.fn().mockResolvedValue([]);
        MockNewsRepository.mockImplementation(function () {
            return { listBySymbol: mockListBySymbol } as never;
        });
    });

    it('calls submitNewsAnalysis with the anonymous-free branch shape', async () => {
        await prewarmNews('AAPL', 'Apple Inc.', false);

        expect(mockSubmitNewsAnalysis).toHaveBeenCalledWith(
            expect.objectContaining({
                symbol: 'AAPL',
                companyName: 'Apple Inc.',
                modelId: DEEPSEEK_V4_FLASH_MODEL,
                tier: 'free',
                reasoning: false,
                skipEnqueueIfMiss: false,
                assetClass: 'equity',
            })
        );
    });

    it('threads force:true when requested', async () => {
        await prewarmNews('AAPL', 'Apple Inc.', true);

        expect(mockSubmitNewsAnalysis).toHaveBeenCalledWith(
            expect.objectContaining({ force: true })
        );
    });

    it('omits force when not requested', async () => {
        await prewarmNews('AAPL', 'Apple Inc.', false);

        const callArg = mockSubmitNewsAnalysis.mock.calls[0]?.[0];
        expect(callArg).not.toHaveProperty('force');
    });

    it('filters out unanalyzed rows (titleKo null) and threads enriched news', async () => {
        mockListBySymbol.mockResolvedValueOnce([ANALYZED_ROW, UNANALYZED_ROW]);

        await prewarmNews('AAPL', 'Apple Inc.', false);

        const callArg = mockSubmitNewsAnalysis.mock.calls[0]?.[0];
        expect(callArg?.news).toHaveLength(1);
    });

    it('includes upcomingCalendar when next earnings exist', async () => {
        mockGetNextEarningsReport.mockResolvedValueOnce(NEXT_EARNINGS);

        await prewarmNews('AAPL', 'Apple Inc.', false);

        expect(mockSubmitNewsAnalysis).toHaveBeenCalledWith(
            expect.objectContaining({ upcomingCalendar: [NEXT_EARNINGS] })
        );
    });

    it('upcomingCalendar is empty when there is no next earnings', async () => {
        await prewarmNews('AAPL', 'Apple Inc.', false);

        expect(mockSubmitNewsAnalysis).toHaveBeenCalledWith(
            expect.objectContaining({ upcomingCalendar: [] })
        );
    });

    it('static guard: the seam source contains no request-context calls', () => {
        const src = readFileSync(
            fileURLToPath(
                new URL('../../lib/prewarmSubmitNews.ts', import.meta.url)
            ),
            'utf8'
        );
        expect(src).not.toMatch(/next\/headers|getCurrentUser|isBot|cookies/);
    });
});
