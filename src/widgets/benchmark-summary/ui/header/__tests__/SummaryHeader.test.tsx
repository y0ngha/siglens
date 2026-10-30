import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SummaryHeader } from '../SummaryHeader';

function renderHeader(centered: boolean) {
    render(
        <SummaryHeader
            headingId="h"
            title="Title"
            sub="Sub text"
            centered={centered}
        />
    );
}

describe('SummaryHeader', () => {
    it('renders a level-2 heading with the given id', () => {
        renderHeader(false);
        expect(
            screen.getByRole('heading', { level: 2, name: 'Title' }).id
        ).toBe('h');
    });

    it('centers the heading and sub text when asked', () => {
        renderHeader(true);
        expect(screen.getByRole('heading').className).toContain('text-center');
        expect(screen.getByText('Sub text').className).toContain('text-center');
    });

    it('leaves them start-aligned by default', () => {
        renderHeader(false);
        expect(screen.getByRole('heading').className).not.toContain(
            'text-center'
        );
        expect(screen.getByText('Sub text').className).not.toContain(
            'text-center'
        );
    });
});
