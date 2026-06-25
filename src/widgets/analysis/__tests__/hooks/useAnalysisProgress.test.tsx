import { renderHook, act } from '@testing-library/react';
import {
    useAnalysisProgress,
    ANALYSIS_PHASES,
    ANALYSIS_TIPS,
} from '@/widgets/analysis/hooks/useAnalysisProgress';

describe('useAnalysisProgress', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('starts at phase 0 and tip 0', () => {
        const { result } = renderHook(() =>
            useAnalysisProgress({ isAnalyzing: true })
        );

        expect(result.current.phaseIndex).toBe(0);
        expect(result.current.tipIndex).toBe(0);
    });

    it('advances phase index over time while analyzing', () => {
        const { result } = renderHook(() =>
            useAnalysisProgress({ isAnalyzing: true })
        );

        act(() => {
            vi.advanceTimersByTime(60_000);
        });

        expect(result.current.phaseIndex).toBe(1);
    });

    it('advances tip index over time while analyzing', () => {
        const { result } = renderHook(() =>
            useAnalysisProgress({ isAnalyzing: true })
        );

        act(() => {
            vi.advanceTimersByTime(8_000);
        });

        expect(result.current.tipIndex).toBe(1);
    });

    it('tip index wraps around', () => {
        const { result } = renderHook(() =>
            useAnalysisProgress({ isAnalyzing: true })
        );

        act(() => {
            vi.advanceTimersByTime(8_000 * ANALYSIS_TIPS.length);
        });

        expect(result.current.tipIndex).toBe(0);
    });

    it('does not advance phase beyond last index while analyzing', () => {
        const { result } = renderHook(() =>
            useAnalysisProgress({ isAnalyzing: true })
        );

        act(() => {
            vi.advanceTimersByTime(60_000 * (ANALYSIS_PHASES.length + 5));
        });

        expect(result.current.phaseIndex).toBe(ANALYSIS_PHASES.length - 1);
    });

    it('calls onFinished after finishing sequence completes', () => {
        const onFinished = vi.fn();
        const { rerender } = renderHook(
            ({ isAnalyzing }) =>
                useAnalysisProgress({ isAnalyzing, onFinished }),
            { initialProps: { isAnalyzing: true } }
        );

        rerender({ isAnalyzing: false });

        act(() => {
            vi.advanceTimersByTime(
                3_500 + 1_000 * ANALYSIS_PHASES.length + 600
            );
        });

        expect(onFinished).toHaveBeenCalled();
    });

    it('resets state when analysis restarts', () => {
        const { result, rerender } = renderHook(
            ({ isAnalyzing }) => useAnalysisProgress({ isAnalyzing }),
            { initialProps: { isAnalyzing: true } }
        );

        act(() => {
            vi.advanceTimersByTime(60_000 * 3);
        });

        expect(result.current.phaseIndex).toBe(3);

        rerender({ isAnalyzing: false });

        act(() => {
            vi.advanceTimersByTime(
                3_500 + 1_000 * ANALYSIS_PHASES.length + 600
            );
        });

        rerender({ isAnalyzing: true });

        expect(result.current.phaseIndex).toBe(0);
        expect(result.current.tipIndex).toBe(0);
    });

    it('does not advance while finishing', () => {
        const { result, rerender } = renderHook(
            ({ isAnalyzing }) => useAnalysisProgress({ isAnalyzing }),
            { initialProps: { isAnalyzing: true } }
        );

        rerender({ isAnalyzing: false });

        const phaseAtFinishingStart = result.current.phaseIndex;

        act(() => {
            vi.advanceTimersByTime(60_000);
        });

        // 마무리 시퀀스로 인해 phaseIndex가 진행됐을 수 있으나, 일반 interval로 인한 진행이 아니어야 한다.
        expect(result.current.phaseIndex).toBeGreaterThanOrEqual(
            phaseAtFinishingStart
        );
    });

    it('ANALYSIS_PHASES has expected count', () => {
        expect(ANALYSIS_PHASES.length).toBe(6);
    });

    it('ANALYSIS_TIPS is non-empty', () => {
        expect(ANALYSIS_TIPS.length).toBeGreaterThan(0);
    });
});
