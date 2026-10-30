import { tryAcquireReanalyzeCooldown } from '@/entities/analysis/lib/reanalyzeCooldown';
import { runOverallAnalysisAction } from '@/entities/analysis/actions/runOverallAnalysisAction';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { shouldAttemptReanalyze } from '../../generationQuota';
import { runOverallDispatch } from '../overallDispatch';
import { releaseCooldownQuietly } from '../releaseCooldown';
import type { DispatchQuotaContext } from '../types';

const { findRecentForPrompt } = vi.hoisted(() => ({
    findRecentForPrompt: vi.fn(),
}));

vi.mock('@/entities/analysis/actions/runOverallAnalysisAction', () => ({
    runOverallAnalysisAction: vi.fn(),
}));
vi.mock('@/entities/analysis/lib/reanalyzeCooldown', () => ({
    tryAcquireReanalyzeCooldown: vi.fn(),
}));
vi.mock('@/entities/analysis/analysisHistoryRepository', () => ({
    DrizzleAnalysisHistoryRepository: vi.fn(function Repo() {
        return { findRecentForPrompt };
    }),
}));
vi.mock('@/entities/news-article/lib/marketEventsLookback', () => ({
    marketEventsLookback: () => ({ fromMs: 1 }),
}));
vi.mock('@/entities/news-article/marketEventsRepository', () => ({
    findMarketEventsForPrompt: vi.fn().mockResolvedValue(['event']),
}));
vi.mock('@/entities/ticker/lib/resolveMarketProfile', () => ({
    resolveMarketProfile: vi.fn().mockResolvedValue('us'),
}));
vi.mock('@/shared/api/market/sessionSpecFor', () => ({
    sessionSpecFor: () => 'session',
}));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: () => ({ db: 'db-handle' }),
}));
vi.mock('../../generationQuota', () => ({ shouldAttemptReanalyze: vi.fn() }));
vi.mock('../releaseCooldown', () => ({ releaseCooldownQuietly: vi.fn() }));

const signal = new AbortController().signal;
const onPromptAssembled = vi.fn();
const quota: DispatchQuotaContext = {
    cacheOnly: false,
    rateLimited: false,
    onPromptAssembled,
};
const params = {
    symbol: 'AAPL',
    companyName: 'Apple',
    timeframe: '1Day',
    modelId: 'm1',
    reasoning: true,
    reanalyze: true,
};

describe('runOverallDispatch', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(shouldAttemptReanalyze).mockReturnValue(false);
        vi.mocked(runOverallAnalysisAction).mockResolvedValue({
            status: 'cached',
        } as never);
        findRecentForPrompt
            .mockResolvedValueOnce(['technical-prior'])
            .mockResolvedValueOnce(['overall-prior']);
    });

    it('재분석 의도가 없으면 쿨다운을 잡지 않고 force 없이 실행한다', async () => {
        await runOverallDispatch(params, signal, 'ko', quota);
        expect(tryAcquireReanalyzeCooldown).not.toHaveBeenCalled();
        expect(runOverallAnalysisAction).toHaveBeenCalledWith(
            'AAPL',
            'Apple',
            '1Day',
            'm1',
            'ko',
            expect.objectContaining({ force: false }),
            signal
        );
    });

    it('재분석 판정에 요청의 의도와 한도 강등 여부를 넘긴다', async () => {
        await runOverallDispatch(params, signal, 'ko', {
            ...quota,
            rateLimited: true,
        });
        expect(shouldAttemptReanalyze).toHaveBeenCalledWith(true, true);
    });

    it('technical 탭과 overall 자신의 이력을 서로 다른 axis로 읽어 넘긴다', async () => {
        await runOverallDispatch(params, signal, 'ko', quota);
        expect(findRecentForPrompt).toHaveBeenNthCalledWith(1, {
            symbol: 'AAPL',
            timeframe: '1Day',
            tab: 'technical',
            session: 'session',
        });
        expect(findRecentForPrompt).toHaveBeenNthCalledWith(2, {
            symbol: 'AAPL',
            timeframe: '1Day',
            tab: 'technical',
            axis: 'overall',
            session: 'session',
        });
        expect(runOverallAnalysisAction).toHaveBeenCalledWith(
            'AAPL',
            'Apple',
            '1Day',
            'm1',
            'ko',
            {
                force: false,
                reasoning: true,
                priorAnalyses: ['overall-prior'],
                technicalPriorAnalyses: ['technical-prior'],
                marketEvents: ['event'],
                cacheOnly: false,
                onPromptAssembled,
            },
            signal
        );
    });

    it('쿨다운을 획득하면 키를 `<tf>:overall`로 분리해 force로 실행한다', async () => {
        vi.mocked(shouldAttemptReanalyze).mockReturnValue(true);
        vi.mocked(tryAcquireReanalyzeCooldown).mockResolvedValue({
            ok: true,
        } as never);
        await runOverallDispatch(params, signal, 'ko', quota);
        expect(tryAcquireReanalyzeCooldown).toHaveBeenCalledWith(
            'AAPL',
            '1Day:overall'
        );
        expect(runOverallAnalysisAction).toHaveBeenCalledWith(
            'AAPL',
            'Apple',
            '1Day',
            'm1',
            'ko',
            expect.objectContaining({ force: true }),
            signal
        );
    });

    it('쿨다운 중이면 남은 시간을 돌려주고 분석도 이력 조회도 하지 않는다', async () => {
        vi.mocked(shouldAttemptReanalyze).mockReturnValue(true);
        vi.mocked(tryAcquireReanalyzeCooldown).mockResolvedValue({
            ok: false,
            remainingMs: 1234,
        } as never);
        await expect(
            runOverallDispatch(params, signal, 'ko', quota)
        ).resolves.toEqual({ status: 'reanalyze_cooldown', remainingMs: 1234 });
        expect(runOverallAnalysisAction).not.toHaveBeenCalled();
        expect(findRecentForPrompt).not.toHaveBeenCalled();
    });

    it('쿨다운을 잡은 분석이 실패하면 쿨다운을 되돌리고 같은 오류로 reject한다', async () => {
        vi.mocked(shouldAttemptReanalyze).mockReturnValue(true);
        vi.mocked(tryAcquireReanalyzeCooldown).mockResolvedValue({
            ok: true,
        } as never);
        const failure = new Error('llm down');
        vi.mocked(runOverallAnalysisAction).mockRejectedValue(failure);
        await expect(
            runOverallDispatch(params, signal, 'ko', quota)
        ).rejects.toBe(failure);
        expect(releaseCooldownQuietly).toHaveBeenCalledWith(
            'AAPL',
            '1Day:overall',
            '[streamAnalysisRoute] overall cooldown release failed:'
        );
    });

    it('쿨다운을 잡지 않은 분석이 실패하면 해제하지 않는다', async () => {
        const failure = new Error('llm down');
        vi.mocked(runOverallAnalysisAction).mockRejectedValue(failure);
        await expect(
            runOverallDispatch(params, signal, 'ko', quota)
        ).rejects.toBe(failure);
        expect(releaseCooldownQuietly).not.toHaveBeenCalled();
    });
});
