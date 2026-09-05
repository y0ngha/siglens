import { render, screen, act } from '@testing-library/react';
import {
    ShareableAnalysisProvider,
    useShareable,
    useRegisterShareable,
} from '@/features/share';
import type { ShareableRegistration } from '@/features/share/model/ShareableAnalysisContext';

function Reader() {
    const reg = useShareable();
    return (
        <>
            <div data-testid="status">{reg ? reg.status : 'none'}</div>
            <div data-testid="plain">{reg?.plain ?? 'none'}</div>
        </>
    );
}
function Registrar({ reg }: { reg: ShareableRegistration }) {
    useRegisterShareable(reg);
    return null;
}
const baseReg = {
    kind: 'chart',
    status: 'success',
    result: { trend: 'bullish' },
    context: { symbol: 'AAPL', displayName: 'Apple', assetClass: 'us_equity' },
    trigger: () => {},
} as unknown as ShareableRegistration;

describe('ShareableAnalysisContext', () => {
    it('exposes the registered value via useShareable', () => {
        render(
            <ShareableAnalysisProvider>
                <Registrar reg={baseReg} />
                <Reader />
            </ShareableAnalysisProvider>
        );
        expect(screen.getByTestId('status').textContent).toBe('success');
    });
    it('returns null when nothing registered', () => {
        render(
            <ShareableAnalysisProvider>
                <Reader />
            </ShareableAnalysisProvider>
        );
        expect(screen.getByTestId('status').textContent).toBe('none');
    });
    it('clears registration on unmount', () => {
        const { rerender } = render(
            <ShareableAnalysisProvider>
                <Registrar reg={baseReg} />
                <Reader />
            </ShareableAnalysisProvider>
        );
        act(() => {
            rerender(
                <ShareableAnalysisProvider>
                    <Reader />
                </ShareableAnalysisProvider>
            );
        });
        expect(screen.getByTestId('status').textContent).toBe('none');
    });
    /**
     * 평이화 산문은 분석 결과보다 늦게 붙을 수 있다. 재등록이 일어나지 않으면
     * 그 사이에 누른 공유는 산문 없는 스냅샷이 되어, 링크를 받은 사람에게
     * 쉽게보기 토글이 영영 안 뜬다.
     */
    it('re-registers when plain prose arrives after the result', () => {
        const { rerender } = render(
            <ShareableAnalysisProvider>
                <Registrar reg={baseReg} />
                <Reader />
            </ShareableAnalysisProvider>
        );
        expect(screen.getByTestId('plain').textContent).toBe('none');
        act(() => {
            rerender(
                <ShareableAnalysisProvider>
                    <Registrar
                        reg={
                            {
                                ...baseReg,
                                plain: '쉬운 설명입니다.',
                            } as unknown as ShareableRegistration
                        }
                    />
                    <Reader />
                </ShareableAnalysisProvider>
            );
        });
        expect(screen.getByTestId('plain').textContent).toBe(
            '쉬운 설명입니다.'
        );
    });
    it('does not enter a re-registration render storm when inputs are unstable objects', () => {
        // Mirrors ChartContent: a fresh `context`/`trigger`/`result` object every
        // render. Pre-fix this looped infinitely (heap OOM). The cap converts a
        // regression into a clean throw instead of exhausting memory.
        let renders = 0;
        function UnstableRegistrar() {
            renders++;
            if (renders > 25) {
                throw new Error(`re-registration storm: ${renders} renders`);
            }
            const reg = {
                kind: 'chart',
                status: 'success',
                result: { trend: 'bullish' },
                context: {
                    symbol: 'AAPL',
                    displayName: 'Apple',
                    assetClass: 'us_equity',
                },
                trigger: () => {},
            } as unknown as ShareableRegistration;
            useRegisterShareable(reg);
            return null;
        }
        render(
            <ShareableAnalysisProvider>
                <UnstableRegistrar />
                <Reader />
            </ShareableAnalysisProvider>
        );
        act(() => {});
        expect(renders).toBeLessThanOrEqual(4);
        expect(screen.getByTestId('status').textContent).toBe('success');
    });
});
