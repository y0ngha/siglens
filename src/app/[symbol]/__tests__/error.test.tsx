// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import SymbolError from '../error';

describe('SymbolError ([symbol] subtree error boundary)', () => {
    const error = Object.assign(new Error('boom'), { digest: 'deadbeef' });

    it('renders exactly one h1 (single-h1 contract is preserved even on error)', () => {
        const { container } = render(
            <SymbolError error={error} reset={vi.fn()} />
        );
        expect(container.querySelectorAll('h1')).toHaveLength(1);
    });

    it('wires the retry button to reset()', () => {
        const reset = vi.fn();
        render(<SymbolError error={error} reset={reset} />);

        screen.getByRole('button', { name: '다시 시도' }).click();

        expect(reset).toHaveBeenCalledTimes(1);
    });

    it('offers a working home link', () => {
        render(<SymbolError error={error} reset={vi.fn()} />);

        expect(screen.getByRole('link', { name: /홈으로/ })).toHaveAttribute(
            'href',
            '/'
        );
    });

    it('logs the error (with its digest) for server-side correlation', () => {
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);

        render(<SymbolError error={error} reset={vi.fn()} />);

        expect(errorSpy).toHaveBeenCalledWith(
            '[SymbolRoute] render error:',
            error
        );
        errorSpy.mockRestore();
    });
});
