// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/link', () => ({
    default: ({
        href,
        children,
        ...rest
    }: {
        href: string;
        children: React.ReactNode;
        [key: string]: unknown;
    }) => (
        <a href={href} {...rest}>
            {children}
        </a>
    ),
}));
vi.mock('@/shared/lib/seo', () => ({
    SITE_NAME: 'Siglens',
}));

import RootError from '../error';

describe('RootError (root /app error boundary)', () => {
    const error = Object.assign(new Error('boom'), { digest: 'deadbeef' });

    it('renders exactly one h1', () => {
        const { container } = render(
            <RootError error={error} reset={vi.fn()} />
        );
        expect(container.querySelectorAll('h1')).toHaveLength(1);
    });

    it('wires the retry button to reset()', () => {
        const reset = vi.fn();
        render(<RootError error={error} reset={reset} />);
        screen.getByRole('button', { name: '다시 시도' }).click();
        expect(reset).toHaveBeenCalledTimes(1);
    });

    it('offers a working home link', () => {
        render(<RootError error={error} reset={vi.fn()} />);
        expect(screen.getByRole('link', { name: /홈으로/ })).toHaveAttribute(
            'href',
            '/'
        );
    });

    it('logs the error for server-side correlation', () => {
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);

        render(<RootError error={error} reset={vi.fn()} />);

        expect(errorSpy).toHaveBeenCalledWith(
            '[RootRoute] render error:',
            error
        );
        errorSpy.mockRestore();
    });
});
