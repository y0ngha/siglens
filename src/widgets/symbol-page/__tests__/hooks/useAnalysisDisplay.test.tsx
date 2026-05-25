import { renderHook, act } from '@testing-library/react';
import { useAnalysisDisplay } from '@/widgets/symbol-page/hooks/useAnalysisDisplay';

describe('useAnalysisDisplay', () => {
    it('initializes displayAnalyzing from isAnalyzing prop', () => {
        const { result } = renderHook(() => useAnalysisDisplay(true));
        expect(result.current.displayAnalyzing).toBe(true);
    });

    it('initializes to false when not analyzing', () => {
        const { result } = renderHook(() => useAnalysisDisplay(false));
        expect(result.current.displayAnalyzing).toBe(false);
    });

    it('sets displayAnalyzing to true when isAnalyzing transitions false -> true', () => {
        const { result, rerender } = renderHook(
            ({ isAnalyzing }) => useAnalysisDisplay(isAnalyzing),
            { initialProps: { isAnalyzing: false } }
        );

        expect(result.current.displayAnalyzing).toBe(false);

        rerender({ isAnalyzing: true });
        expect(result.current.displayAnalyzing).toBe(true);
    });

    it('does not automatically set displayAnalyzing to false when isAnalyzing transitions true -> false', () => {
        const { result, rerender } = renderHook(
            ({ isAnalyzing }) => useAnalysisDisplay(isAnalyzing),
            { initialProps: { isAnalyzing: true } }
        );

        expect(result.current.displayAnalyzing).toBe(true);

        rerender({ isAnalyzing: false });
        expect(result.current.displayAnalyzing).toBe(true);
    });

    it('sets displayAnalyzing to false only via handleProgressFinished', () => {
        const { result, rerender } = renderHook(
            ({ isAnalyzing }) => useAnalysisDisplay(isAnalyzing),
            { initialProps: { isAnalyzing: true } }
        );

        rerender({ isAnalyzing: false });
        expect(result.current.displayAnalyzing).toBe(true);

        act(() => {
            result.current.handleProgressFinished();
        });

        expect(result.current.displayAnalyzing).toBe(false);
    });

    it('handleProgressFinished is stable across renders', () => {
        const { result, rerender } = renderHook(
            ({ isAnalyzing }) => useAnalysisDisplay(isAnalyzing),
            { initialProps: { isAnalyzing: false } }
        );

        const first = result.current.handleProgressFinished;
        rerender({ isAnalyzing: true });
        expect(result.current.handleProgressFinished).toBe(first);
    });
});
