import { after } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DrizzleAnalysisHistoryRepository } from '@/entities/analysis/analysisHistoryRepository';
import {
    DEFAULT_TECHNICAL_MODEL_ID,
    schedulePersistAnalysisHistory,
} from '../persistAnalysisHistory';

const { saveAnalysisHistory } = vi.hoisted(() => ({
    saveAnalysisHistory: vi.fn(),
}));

vi.mock('next/server', () => ({ after: vi.fn() }));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: () => ({ db: 'db-handle' }),
}));
vi.mock('@/entities/analysis/analysisHistoryRepository', () => ({
    DrizzleAnalysisHistoryRepository: vi.fn(function Repo() {
        return { saveAnalysisHistory };
    }),
    resolveGeneratedAt: (result: { analyzedAt?: string }) =>
        result.analyzedAt ?? 'now',
}));

const input = {
    symbol: 'AAPL',
    timeframe: '1Day',
    tab: 'technical' as const,
    modelId: 'deepseek-v4',
    locale: 'ko' as const,
    result: { analyzedAt: '2026-01-01T00:00:00Z' },
    prompt: undefined,
};

describe('schedulePersistAnalysisHistory', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('모델 미지정 요청의 기록값은 analysis-worker다', () => {
        expect(DEFAULT_TECHNICAL_MODEL_ID).toBe('analysis-worker');
    });

    it('after()로 스케줄하고 즉시 저장하지 않는다', () => {
        schedulePersistAnalysisHistory(input);
        expect(after).toHaveBeenCalledTimes(1);
        expect(saveAnalysisHistory).not.toHaveBeenCalled();
    });

    it('after 콜백이 분석 자신의 생성 시각으로 저장한다', async () => {
        schedulePersistAnalysisHistory(input);
        const callback = vi.mocked(after).mock.calls[0]?.[0];
        if (typeof callback !== 'function') throw new Error('no callback');
        await callback();
        expect(DrizzleAnalysisHistoryRepository).toHaveBeenCalledWith(
            'db-handle'
        );
        expect(saveAnalysisHistory).toHaveBeenCalledWith({
            symbol: 'AAPL',
            timeframe: '1Day',
            tab: 'technical',
            modelId: 'deepseek-v4',
            locale: 'ko',
            result: input.result,
            generatedAt: '2026-01-01T00:00:00Z',
            prompt: undefined,
        });
    });

    it('after()가 동기적으로 throw해도 삼키고 로그만 남긴다', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const failure = new Error('outside request scope');
        vi.mocked(after).mockImplementation(() => {
            throw failure;
        });
        expect(() => schedulePersistAnalysisHistory(input)).not.toThrow();
        expect(spy).toHaveBeenCalledWith(
            '[streamAnalysisRoute] schedulePersistAnalysisHistory failed:',
            failure
        );
        spy.mockRestore();
    });
});
