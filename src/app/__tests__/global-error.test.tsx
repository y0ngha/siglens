// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import GlobalError from '../global-error';

describe('GlobalError (root-layout error boundary)', () => {
    const error = Object.assign(new Error('layout crash'), {
        digest: 'cafebabe',
    });

    it('renders its own <html lang="ko"> and <body> (replaces root layout)', () => {
        const { container } = render(
            <GlobalError error={error} reset={vi.fn()} />
        );
        // jsdom renders into a document fragment — the html/body wrapper is the
        // component's own output, verified via the rendered text content.
        expect(container.textContent).toContain('다시 시도');
        expect(container.textContent).toContain('홈으로');
    });

    it('renders a heading (non-empty branded message)', () => {
        render(<GlobalError error={error} reset={vi.fn()} />);
        expect(screen.getByRole('heading')).toBeInTheDocument();
    });

    it('wires the retry button to reset()', () => {
        const reset = vi.fn();
        render(<GlobalError error={error} reset={reset} />);
        screen.getByRole('button', { name: '다시 시도' }).click();
        expect(reset).toHaveBeenCalledTimes(1);
    });

    it('offers a home link pointing to "/"', () => {
        render(<GlobalError error={error} reset={vi.fn()} />);
        expect(screen.getByRole('link', { name: /홈으로/ })).toHaveAttribute(
            'href',
            '/'
        );
    });

    it('logs the error on mount', () => {
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);

        render(<GlobalError error={error} reset={vi.fn()} />);

        expect(errorSpy).toHaveBeenCalledWith(
            '[GlobalError] root layout error:',
            error
        );
        errorSpy.mockRestore();
    });
});
