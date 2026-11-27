vi.mock('server-only', () => ({}));

vi.mock('@/entities/auth/server/getCurrentUser', () => ({
    getCurrentUser: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/shared/lib/byokGate', () => ({
    resolveTierAndByok: vi.fn(),
    buildGateError: vi.fn().mockResolvedValue({ code: 'unexpected' }),
}));

vi.mock('../server/overallAnalysisRunner', () => ({
    executeOverallAnalysis: vi.fn(),
}));

import { runOverallAnalysisAction } from '../actions/runOverallAnalysisAction';
import { executeOverallAnalysis } from '../server/overallAnalysisRunner';
import { resolveTierAndByok } from '@/shared/lib/byokGate';

describe('runOverallAnalysisAction', () => {
    beforeEach(() => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    describe('timeframe이 siglens TIMEFRAMES 밖일 때', () => {
        it('목록 밖의 값(2Week)은 게이트·분석 전에 일반 오류로 거절한다', async () => {
            const result = await runOverallAnalysisAction(
                'AAPL',
                'Apple',
                '2Week' as never,
                'deepseek-v4-flash' as never,
                'ko'
            );

            expect(result).toEqual({
                status: 'error',
                error: { code: 'unexpected' },
            });
            expect(resolveTierAndByok).not.toHaveBeenCalled();
            expect(executeOverallAnalysis).not.toHaveBeenCalled();
        });
    });

    describe('주봉(1Week) 요청', () => {
        it('게이트를 거쳐 1Week 그대로 종합 분석에 넘긴다', async () => {
            vi.mocked(resolveTierAndByok).mockResolvedValueOnce({
                kind: 'allowed',
                tier: 'member',
            } as never);
            vi.mocked(executeOverallAnalysis).mockResolvedValueOnce({
                status: 'success',
            } as never);

            const result = await runOverallAnalysisAction(
                'AAPL',
                'Apple',
                '1Week',
                'deepseek-v4-flash' as never,
                'ko'
            );

            expect(result).toEqual({ status: 'success' });
            expect(executeOverallAnalysis).toHaveBeenCalledWith(
                expect.objectContaining({ symbol: 'AAPL', timeframe: '1Week' })
            );
        });
    });
});
