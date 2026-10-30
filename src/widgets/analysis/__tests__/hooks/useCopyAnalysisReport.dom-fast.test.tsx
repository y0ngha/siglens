import { act, renderHook } from '@testing-library/react';
import type {
    AnalysisResponse,
    ClusteredKeyLevels,
} from '@y0ngha/siglens-core';
import { buildFallbackAnalysis } from '@/entities/analysis/lib/fallbackAnalysis';
import { IntlTestProvider } from '@/shared/test-utils/intlRenderWrapper';
import { useCopyAnalysisReport } from '@/widgets/analysis/hooks/useCopyAnalysisReport';

const ANALYSIS: AnalysisResponse = {
    ...buildFallbackAnalysis('요약'),
    trend: 'bullish',
};
const KEY_LEVELS: ClusteredKeyLevels = { support: [], resistance: [] };

function setup(disabled: boolean) {
    return renderHook(
        () =>
            useCopyAnalysisReport({
                symbol: 'aapl',
                krxTickTable: 'share',
                analysis: ANALYSIS,
                keyLevels: KEY_LEVELS,
                disabled,
            }),
        { wrapper: IntlTestProvider }
    );
}

describe('useCopyAnalysisReport', () => {
    const writeText = vi.fn((_text: string) => Promise.resolve());

    beforeEach(() => {
        writeText.mockClear();
        Object.defineProperty(navigator, 'clipboard', {
            value: { writeText },
            configurable: true,
        });
    });

    it('리포트를 만들어 복사하고 상태를 copied로 바꾼다', async () => {
        const { result } = setup(false);
        expect(result.current.copyState).toBe('idle');

        await act(async () => {
            result.current.copyReport();
        });

        expect(writeText).toHaveBeenCalledTimes(1);
        expect(writeText.mock.calls[0][0]).toContain('[AAPL]');
        await vi.waitFor(() => expect(result.current.copyState).toBe('copied'));
    });

    it('비활성화되면 복사하지 않는다', async () => {
        const { result } = setup(true);
        await act(async () => {
            result.current.copyReport();
        });
        expect(writeText).not.toHaveBeenCalled();
        expect(result.current.copyState).toBe('idle');
    });

    it('클립보드 쓰기가 실패하면 failed다', async () => {
        writeText.mockImplementationOnce(() => Promise.reject(new Error('x')));
        const { result } = setup(false);
        await act(async () => {
            result.current.copyReport();
        });
        await vi.waitFor(() => expect(result.current.copyState).toBe('failed'));
    });
});
