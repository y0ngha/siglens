import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BenchmarkDetailLink } from '../BenchmarkDetailLink';

describe('BenchmarkDetailLink', () => {
    it('links the visible label to the given href', () => {
        render(
            <BenchmarkDetailLink
                href="https://ai.test/benchmark"
                label="More"
                centered={false}
            />
        );
        expect(
            screen.getByRole('link', { name: 'More' }).getAttribute('href')
        ).toBe('https://ai.test/benchmark');
    });

    it('centers its line only when asked', () => {
        const { rerender } = render(
            <BenchmarkDetailLink href="/x" label="More" centered />
        );
        const line = () => screen.getByRole('link').parentElement!;
        expect(line().className).toContain('text-center');
        rerender(
            <BenchmarkDetailLink href="/x" label="More" centered={false} />
        );
        expect(line().className).not.toContain('text-center');
    });
});
