// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import MarketError from '../error';

describe('MarketError (/market route error boundary)', () => {
    const error = Object.assign(new Error('boom'), { digest: 'deadbeef' });

    it('renders exactly one h1 (single-h1 contract is preserved even on error)', () => {
        const { container } = render(
            <MarketError error={error} reset={vi.fn()} />
        );
        expect(container.querySelectorAll('h1')).toHaveLength(1);
    });

    it('wires the retry button to reset()', () => {
        const reset = vi.fn();
        render(<MarketError error={error} reset={reset} />);

        screen.getByRole('button', { name: '다시 시도' }).click();

        expect(reset).toHaveBeenCalledTimes(1);
    });

    it('offers a working home link', () => {
        render(<MarketError error={error} reset={vi.fn()} />);

        expect(screen.getByRole('link', { name: /홈으로/ })).toHaveAttribute(
            'href',
            '/'
        );
    });

    it('logs the error (with its digest) for server-side correlation', () => {
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);

        render(<MarketError error={error} reset={vi.fn()} />);

        expect(errorSpy).toHaveBeenCalledWith(
            '[MarketRoute] render error:',
            error
        );
        errorSpy.mockRestore();
    });
});
