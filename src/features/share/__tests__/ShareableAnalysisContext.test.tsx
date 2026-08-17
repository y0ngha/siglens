import { render, screen, act } from '@testing-library/react';
import {
    ShareableAnalysisProvider,
    useShareable,
    useRegisterShareable,
} from '@/features/share';
import type { ShareableRegistration } from '@/features/share/model/ShareableAnalysisContext';

function Reader() {
    const reg = useShareable();
    return <div data-testid="status">{reg ? reg.status : 'none'}</div>;
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
    it('does not enter a re-registration render storm when inputs are unstable objects', () => {
        // Mirrors ChartContent: a fresh `context`/`trigger`/`result` object every
        // render. Pre-fix this looped infinitely (heap OOM). The cap converts a
        // regression into a clean throw instead of exhausting memory.
        const counter = { renders: 0 };
        function UnstableRegistrar() {
            // 이 컴포넌트는 "매 렌더마다 새 객체"를 일부러 만들어 재등록 폭주를
            // 재현한다 — React Compiler가 메모화하면 재현 대상 자체가 사라지므로
            // 컴파일러 최적화에서 명시적으로 제외한다(공식 escape hatch).
            'use no memo';
            counter.renders += 1;
            if (counter.renders > 25) {
                throw new Error(
                    `re-registration storm: ${counter.renders} renders`
                );
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
        expect(counter.renders).toBeLessThanOrEqual(4);
        expect(screen.getByTestId('status').textContent).toBe('success');
    });
});
