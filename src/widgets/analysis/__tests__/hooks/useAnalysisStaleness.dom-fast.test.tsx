import { renderHook } from '@testing-library/react';
import { isAnalysisStale } from '@/entities/analysis/lib/staleThreshold';
import { useAnalysisStaleness } from '@/widgets/analysis/hooks/useAnalysisStaleness';

vi.mock('@/entities/analysis/lib/staleThreshold', () => ({
    isAnalysisStale: vi.fn(() => true),
}));

const ANALYZED_AT = '2026-01-01T00:00:00Z';

describe('useAnalysisStaleness', () => {
    beforeEach(() => {
        vi.mocked(isAnalysisStale).mockClear();
    });

    it('mount 이후 캡처한 현재 시각으로 stale을 판정한다', async () => {
        const { result } = renderHook(() =>
            useAnalysisStaleness({
                analyzedAt: ANALYZED_AT,
                timeframe: '1Day',
                enabled: true,
            })
        );
        await vi.waitFor(() => expect(result.current).toBe(true));
        expect(isAnalysisStale).toHaveBeenCalledWith(
            ANALYZED_AT,
            '1Day',
            expect.any(Date)
        );
    });

    it('비활성화되면 판정하지 않고 false다', () => {
        const { result } = renderHook(() =>
            useAnalysisStaleness({
                analyzedAt: ANALYZED_AT,
                timeframe: '1Day',
                enabled: false,
            })
        );
        expect(result.current).toBe(false);
        expect(isAnalysisStale).not.toHaveBeenCalled();
    });

    it('analyzedAt이 없으면 false다', () => {
        const { result } = renderHook(() =>
            useAnalysisStaleness({
                analyzedAt: undefined,
                timeframe: '1Day',
                enabled: true,
            })
        );
        expect(result.current).toBe(false);
        expect(isAnalysisStale).not.toHaveBeenCalled();
    });
});
