import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SummaryCardNote } from '../SummaryCardNote';

describe('SummaryCardNote', () => {
    it('uses tabular digits when the line is numeric', () => {
        render(<SummaryCardNote numeric>1.0</SummaryCardNote>);
        expect(screen.getByText('1.0').className).toContain('tabular-nums');
    });

    it('keeps proportional digits by default', () => {
        render(<SummaryCardNote>note</SummaryCardNote>);
        expect(screen.getByText('note').className).not.toContain(
            'tabular-nums'
        );
    });
});
