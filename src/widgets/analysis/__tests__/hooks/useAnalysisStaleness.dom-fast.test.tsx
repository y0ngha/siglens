import { US_EQUITY_SESSION } from '@y0ngha/siglens-core';
import { act, renderHook } from '@testing-library/react';
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
            expect.any(Date),
            undefined
        );
    });

    it('시장 세션을 판정 함수에 그대로 넘긴다', async () => {
        const { result } = renderHook(() =>
            useAnalysisStaleness({
                analyzedAt: ANALYZED_AT,
                timeframe: '1Day',
                session: US_EQUITY_SESSION,
                enabled: true,
            })
        );
        await vi.waitFor(() => expect(result.current).toBe(true));
        expect(isAnalysisStale).toHaveBeenCalledWith(
            ANALYZED_AT,
            '1Day',
            expect.any(Date),
            US_EQUITY_SESSION
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

    describe('탭이 다시 보일 때 현재 시각을 다시 잡는다', () => {
        const NOW_A = new Date('2026-07-14T15:00:00Z');
        const NOW_B = new Date('2026-07-14T21:00:00Z');

        const setVisibility = (state: DocumentVisibilityState): void => {
            Object.defineProperty(document, 'visibilityState', {
                configurable: true,
                value: state,
            });
            document.dispatchEvent(new Event('visibilitychange'));
        };

        afterEach(() => {
            vi.useRealTimers();
            setVisibility('visible');
        });

        it('hidden → visible 전환 때 새 시각으로 다시 판정한다', async () => {
            vi.useFakeTimers({ toFake: ['Date'] });
            vi.setSystemTime(NOW_A);
            renderHook(() =>
                useAnalysisStaleness({
                    analyzedAt: ANALYZED_AT,
                    timeframe: '1Day',
                    session: US_EQUITY_SESSION,
                    enabled: true,
                })
            );
            await vi.waitFor(() =>
                expect(
                    vi
                        .mocked(isAnalysisStale)
                        .mock.calls.some(
                            ([, , now]) => now.getTime() === NOW_A.getTime()
                        )
                ).toBe(true)
            );

            vi.setSystemTime(NOW_B);
            act(() => {
                setVisibility('hidden');
            });
            // 숨겨질 때는 다시 잡지 않는다.
            expect(
                vi
                    .mocked(isAnalysisStale)
                    .mock.calls.some(
                        ([, , now]) => now.getTime() === NOW_B.getTime()
                    )
            ).toBe(false);

            act(() => {
                setVisibility('visible');
            });
            await vi.waitFor(() =>
                expect(
                    vi
                        .mocked(isAnalysisStale)
                        .mock.calls.some(
                            ([, , now]) => now.getTime() === NOW_B.getTime()
                        )
                ).toBe(true)
            );
        });

        it('언마운트하면 리스너를 해제한다', () => {
            const removeSpy = vi.spyOn(document, 'removeEventListener');
            const { unmount } = renderHook(() =>
                useAnalysisStaleness({
                    analyzedAt: ANALYZED_AT,
                    timeframe: '1Day',
                    enabled: true,
                })
            );
            unmount();
            expect(removeSpy).toHaveBeenCalledWith(
                'visibilitychange',
                expect.any(Function)
            );
            removeSpy.mockRestore();
        });
    });
});
