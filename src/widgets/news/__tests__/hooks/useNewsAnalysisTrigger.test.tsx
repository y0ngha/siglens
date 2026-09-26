// @vitest-environment jsdom
const ensureSpy = vi.hoisted(() => vi.fn());
vi.mock('@/entities/news-article/actions', () => ({
    ensureNewsCardsAnalyzedAction: ensureSpy,
}));

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StrictMode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { useNewsAnalysisTrigger } from '@/widgets/news/hooks/useNewsAnalysisTrigger';

describe('useNewsAnalysisTrigger', () => {
    beforeEach(() => {
        ensureSpy.mockReset();
        ensureSpy.mockResolvedValue(undefined);
    });

    it('마운트 시 해당 symbol로 ensureNewsCardsAnalyzedAction을 1회 호출한다', () => {
        renderHook(() => useNewsAnalysisTrigger('AAPL'));

        expect(ensureSpy).toHaveBeenCalledTimes(1);
        expect(ensureSpy).toHaveBeenCalledWith('AAPL');
    });

    it('같은 symbol로 재렌더 시 재호출하지 않는다 (ref 가드 — StrictMode 이중 마운트 방지)', () => {
        const { rerender } = renderHook(({ s }) => useNewsAnalysisTrigger(s), {
            initialProps: { s: 'AAPL' },
        });

        rerender({ s: 'AAPL' });

        expect(ensureSpy).toHaveBeenCalledTimes(1);
    });

    it('symbol이 바뀌면(언마운트 없이) 새 symbol로 다시 호출한다', () => {
        const { rerender } = renderHook(({ s }) => useNewsAnalysisTrigger(s), {
            initialProps: { s: 'AAPL' },
        });

        rerender({ s: 'TSLA' });

        expect(ensureSpy).toHaveBeenCalledTimes(2);
        expect(ensureSpy).toHaveBeenNthCalledWith(1, 'AAPL');
        expect(ensureSpy).toHaveBeenNthCalledWith(2, 'TSLA');
    });

    it('액션이 reject해도 throw하지 않고 에러를 로깅한다(fire-and-forget)', async () => {
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);
        ensureSpy.mockRejectedValue(new Error('boom'));

        renderHook(() => useNewsAnalysisTrigger('AAPL'));

        await waitFor(() => expect(errorSpy).toHaveBeenCalled());
        errorSpy.mockRestore();
    });

    it('StrictMode 이중 invoke에서도 1회만 호출한다 (effect 재실행 시 ref===symbol → early-return 가드)', () => {
        // StrictMode(dev)는 같은 인스턴스에서 effect setup→cleanup→setup을 한 번 더 돌린다.
        // 두 번째 setup 시 ref.current가 이미 'AAPL'이라 early-return으로 중복 트리거를 막는다.
        renderHook(() => useNewsAnalysisTrigger('AAPL'), {
            wrapper: StrictMode,
        });

        expect(ensureSpy).toHaveBeenCalledTimes(1);
    });

    /**
     * 수동 `<StrictMode>` wrapper는 RTL의 act 배치 방식 때문에 개발 모드의
     * "setup→cleanup→setup" 이중 invoke를 실제로 재현하지 못할 수 있다. RTL의
     * `reactStrictMode` 렌더 옵션은 React 자체의 이중 invoke 계약을 보다 충실히
     * 재현하므로, 같은 불변조건(중복 분석 job 없음)을 별도 경로로 다시 검증한다.
     */
    it('reactStrictMode 렌더 옵션의 이중 invoke에서도 1회만 호출한다', () => {
        renderHook(() => useNewsAnalysisTrigger('AAPL'), {
            reactStrictMode: true,
        });

        expect(ensureSpy).toHaveBeenCalledTimes(1);
        expect(ensureSpy).toHaveBeenCalledWith('AAPL');
    });
});
