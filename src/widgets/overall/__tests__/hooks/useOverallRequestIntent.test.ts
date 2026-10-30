// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { useOverallRequestIntent } from '@/widgets/overall/hooks/useOverallRequestIntent';

describe('useOverallRequestIntent', () => {
    it('아무 요청도 허락하기 전에는 캐시 전용 의도다', () => {
        const { result } = renderHook(() => useOverallRequestIntent());

        expect(result.current.isGenerationAuthorized).toBe(false);
        expect(result.current.consumeIntent()).toBe('cache');
    });

    it('생성을 허락하면 이후 요청은 모두 generate다', () => {
        const { result } = renderHook(() => useOverallRequestIntent());

        act(() => {
            result.current.authorizeGeneration();
        });

        expect(result.current.isGenerationAuthorized).toBe(true);
        expect(result.current.consumeIntent()).toBe('generate');
        expect(result.current.consumeIntent()).toBe('generate');
    });

    it('재분석 표시는 한 번만 쓰이고 그 뒤에는 generate로 돌아온다', () => {
        const { result } = renderHook(() => useOverallRequestIntent());

        act(() => {
            result.current.markReanalyze();
        });

        expect(result.current.consumeIntent()).toBe('reanalyze');
        expect(result.current.consumeIntent()).toBe('generate');
    });

    it('재분석 표시는 생성도 함께 허락한다', () => {
        const { result } = renderHook(() => useOverallRequestIntent());

        act(() => {
            result.current.markReanalyze();
        });

        expect(result.current.isGenerationAuthorized).toBe(true);
    });

    it('거둔 재분석 표시는 다음 요청에 쓰이지 않는다', () => {
        const { result } = renderHook(() => useOverallRequestIntent());
        act(() => {
            result.current.markReanalyze();
        });

        result.current.clearReanalyze();

        expect(result.current.consumeIntent()).toBe('generate');
    });
});
