import { render, screen, renderHook } from '@testing-library/react';
import {
    SymbolPageProvider,
    useSymbolPageContext,
} from '@/widgets/symbol-page/SymbolPageContext';

describe('SymbolPageContext', () => {
    it('provides indicatorCount to consumers', () => {
        function Consumer() {
            const ctx = useSymbolPageContext();
            return <span data-testid="count">{ctx.indicatorCount}</span>;
        }

        render(
            <SymbolPageProvider indicatorCount={42}>
                <Consumer />
            </SymbolPageProvider>
        );

        expect(screen.getByTestId('count').textContent).toBe('42');
    });

    it('throws when used outside provider', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

        expect(() => {
            renderHook(() => useSymbolPageContext());
        }).toThrow(
            'useSymbolPageContext must be used inside SymbolPageProvider'
        );

        spy.mockRestore();
    });

    it('renders children', () => {
        render(
            <SymbolPageProvider indicatorCount={0}>
                <span data-testid="child">hello</span>
            </SymbolPageProvider>
        );

        expect(screen.getByTestId('child').textContent).toBe('hello');
    });
});
