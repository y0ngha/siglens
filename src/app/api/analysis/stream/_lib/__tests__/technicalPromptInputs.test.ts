import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listEarningsDates } from '@/entities/earnings-report/api';
import { marketEventsLookback } from '@/entities/news-article/lib/marketEventsLookback';
import { findMarketEventsForPrompt } from '@/entities/news-article/marketEventsRepository';
import { loadTechnicalPromptInputs } from '../technicalPromptInputs';

const { findRecentForPrompt } = vi.hoisted(() => ({
    findRecentForPrompt: vi.fn(),
}));

vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: () => ({ db: 'db-handle' }),
}));
vi.mock('@/entities/analysis/analysisHistoryRepository', () => ({
    DrizzleAnalysisHistoryRepository: vi.fn(function Repo() {
        return { findRecentForPrompt };
    }),
}));
vi.mock('@/entities/earnings-report/api', () => ({
    listEarningsDates: vi.fn(),
}));
vi.mock('@/entities/news-article/lib/marketEventsLookback', () => ({
    marketEventsLookback: vi.fn(),
}));
vi.mock('@/entities/news-article/marketEventsRepository', () => ({
    findMarketEventsForPrompt: vi.fn(),
}));

const SESSION = { kind: 'session' } as never;

describe('loadTechnicalPromptInputs', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        findRecentForPrompt.mockResolvedValue(['prior']);
        vi.mocked(findMarketEventsForPrompt).mockResolvedValue([
            'event',
        ] as never);
        vi.mocked(listEarningsDates).mockResolvedValue(['2026-02-01'] as never);
        vi.mocked(marketEventsLookback).mockReturnValue({
            fromMs: 1,
            toMs: 2,
        } as never);
    });

    it('이력·이벤트·실적일을 한 객체로 모아 돌려준다', async () => {
        await expect(
            loadTechnicalPromptInputs({
                symbol: 'AAPL',
                timeframe: '1Day',
                session: SESSION,
            })
        ).resolves.toEqual({
            priorAnalyses: ['prior'],
            marketEvents: ['event'],
            earningsDates: ['2026-02-01'],
        });
    });

    it('이력 조회에 technical 탭과 core에 넘기는 세션을 쓴다', async () => {
        await loadTechnicalPromptInputs({
            symbol: 'AAPL',
            timeframe: '1Day',
            session: SESSION,
        });
        expect(findRecentForPrompt).toHaveBeenCalledWith({
            symbol: 'AAPL',
            timeframe: '1Day',
            tab: 'technical',
            session: SESSION,
        });
    });

    it('이벤트 창은 같은 세션으로 만든 룩백을 쓴다', async () => {
        await loadTechnicalPromptInputs({
            symbol: 'AAPL',
            timeframe: '1Day',
            session: SESSION,
        });
        expect(marketEventsLookback).toHaveBeenCalledWith('1Day', SESSION);
        expect(findMarketEventsForPrompt).toHaveBeenCalledWith('db-handle', {
            symbol: 'AAPL',
            fromMs: 1,
            toMs: 2,
        });
    });

    it('실적일은 같은 DB 핸들로 조회한다', async () => {
        await loadTechnicalPromptInputs({
            symbol: 'AAPL',
            timeframe: '1Day',
            session: SESSION,
        });
        expect(listEarningsDates).toHaveBeenCalledWith('AAPL', 'db-handle');
    });

    it('한 조회가 실패하면 reject한다', async () => {
        const failure = new Error('db down');
        findRecentForPrompt.mockRejectedValue(failure);
        await expect(
            loadTechnicalPromptInputs({
                symbol: 'AAPL',
                timeframe: '1Day',
                session: SESSION,
            })
        ).rejects.toBe(failure);
    });
});
