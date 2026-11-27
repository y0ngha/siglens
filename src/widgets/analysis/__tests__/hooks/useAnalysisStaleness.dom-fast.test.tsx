import { act, renderHook } from '@testing-library/react';
import { US_EQUITY_SESSION } from '@y0ngha/siglens-core';
import { renderToString } from 'react-dom/server';
import { isAnalysisStale } from '@/entities/analysis/lib/staleThreshold';
import { renderWithoutAct } from '@/shared/test-utils/renderWithoutAct';
import { useAnalysisStaleness } from '@/widgets/analysis/hooks/useAnalysisStaleness';

vi.mock('@/entities/analysis/lib/staleThreshold', () => ({
    isAnalysisStale: vi.fn(() => true),
}));

const ANALYZED_AT = '2026-01-01T00:00:00Z';

const NOW_MOUNT = new Date('2026-07-14T15:00:00Z');

describe('useAnalysisStaleness', () => {
    beforeEach(() => {
        vi.mocked(isAnalysisStale).mockClear();
        // 판정에 넘긴 `now`를 정확히 단언하므로 Date를 고정한다(TE-7).
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(NOW_MOUNT);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('첫 렌더에서 읽은 현재 시각으로 stale을 판정한다', () => {
        const { result } = renderHook(() =>
            useAnalysisStaleness({
                analyzedAt: ANALYZED_AT,
                timeframe: '1Day',
                enabled: true,
            })
        );
        expect(result.current).toBe(true);
        expect(isAnalysisStale).toHaveBeenCalledWith(
            ANALYZED_AT,
            '1Day',
            NOW_MOUNT,
            undefined
        );
    });

    it('첫 렌더에서 곧바로 stale을 판정한다 — effect·transition을 기다리지 않는다(배너 CLS 방지)', () => {
        function Probe() {
            const stale = useAnalysisStaleness({
                analyzedAt: ANALYZED_AT,
                timeframe: '1Day',
                enabled: true,
            });
            return <span data-testid="probe">{String(stale)}</span>;
        }
        renderWithoutAct(<Probe />, container => {
            expect(container.textContent).toBe('true');
        });
    });

    it('analyzedAt이 바뀌면 같은 렌더에서 새로 잡은 시각으로 다시 판정한다', () => {
        const NEXT_ANALYZED_AT = '2026-01-02T00:00:00Z';
        const { rerender } = renderHook(
            ({ analyzedAt }: { analyzedAt: string | undefined }) =>
                useAnalysisStaleness({
                    analyzedAt,
                    timeframe: '1Day',
                    enabled: true,
                }),
            { initialProps: { analyzedAt: ANALYZED_AT as string | undefined } }
        );
        expect(isAnalysisStale).toHaveBeenLastCalledWith(
            ANALYZED_AT,
            '1Day',
            NOW_MOUNT,
            undefined
        );

        const NOW_NEXT = new Date('2026-07-14T16:30:00Z');
        vi.setSystemTime(NOW_NEXT);
        rerender({ analyzedAt: NEXT_ANALYZED_AT });

        expect(isAnalysisStale).toHaveBeenLastCalledWith(
            NEXT_ANALYZED_AT,
            '1Day',
            NOW_NEXT,
            undefined
        );
    });

    it('서버 렌더에서는 현재 시각이 없어 false다(hydration mismatch 방지)', () => {
        function Probe() {
            const stale = useAnalysisStaleness({
                analyzedAt: ANALYZED_AT,
                timeframe: '1Day',
                enabled: true,
            });
            return <span>{String(stale)}</span>;
        }
        expect(renderToString(<Probe />)).toContain('false');
        expect(isAnalysisStale).not.toHaveBeenCalled();
    });

    it('시장 세션을 판정 함수에 그대로 넘긴다', () => {
        const { result } = renderHook(() =>
            useAnalysisStaleness({
                analyzedAt: ANALYZED_AT,
                timeframe: '1Day',
                session: US_EQUITY_SESSION,
                enabled: true,
            })
        );
        expect(result.current).toBe(true);
        expect(isAnalysisStale).toHaveBeenCalledWith(
            ANALYZED_AT,
            '1Day',
            NOW_MOUNT,
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
