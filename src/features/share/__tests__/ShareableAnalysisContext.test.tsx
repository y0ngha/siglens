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
});
