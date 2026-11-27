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

    describe('timeframe이 siglens TIMEFRAMES 밖일 때 (WP-19)', () => {
        // WP-19: 주봉 UI가 나가면 이 테스트를 1Week 허용 단언으로 바꾼다.
        it('화면이 내지 않는 주기(1Week)는 게이트·분석 전에 일반 오류로 거절한다', async () => {
            const result = await runOverallAnalysisAction(
                'AAPL',
                'Apple',
                '1Week' as never,
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
});
