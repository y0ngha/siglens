// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import {
    SuppressSymbolBottomAd,
    SymbolBottomAdProvider,
    useSymbolBottomAdSuppressed,
} from '@/features/ad-slot/model/SymbolBottomAdContext';

function Probe() {
    return (
        <p data-testid="probe">
            {useSymbolBottomAdSuppressed() ? 'suppressed' : 'open'}
        </p>
    );
}

function Tree({ suppressors }: { suppressors: number }) {
    return (
        <SymbolBottomAdProvider>
            {Array.from({ length: suppressors }, (_, i) => (
                <SuppressSymbolBottomAd key={i} />
            ))}
            <Probe />
        </SymbolBottomAdProvider>
    );
}

describe('SymbolBottomAdContext', () => {
    it('is open when nothing suppresses it', () => {
        render(<Tree suppressors={0} />);
        expect(screen.getByTestId('probe')).toHaveTextContent('open');
    });

    it('is suppressed while a suppressor is mounted and opens again after', () => {
        const { rerender } = render(<Tree suppressors={1} />);
        expect(screen.getByTestId('probe')).toHaveTextContent('suppressed');

        rerender(<Tree suppressors={0} />);
        expect(screen.getByTestId('probe')).toHaveTextContent('open');
    });

    it('stays suppressed until the last suppressor unmounts', () => {
        const { rerender } = render(<Tree suppressors={2} />);
        rerender(<Tree suppressors={1} />);
        expect(screen.getByTestId('probe')).toHaveTextContent('suppressed');
    });

    it('does nothing outside the provider', () => {
        render(
            <>
                <SuppressSymbolBottomAd />
                <Probe />
            </>
        );
        expect(screen.getByTestId('probe')).toHaveTextContent('open');
    });
});
