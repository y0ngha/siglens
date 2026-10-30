import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { summaryGridColumnsClass } from '../../../utils/summaryGridColumns';
import { SummaryCardList } from '../SummaryCardList';

describe('SummaryCardList', () => {
    it('applies the column class for its card count', () => {
        render(
            <SummaryCardList cardCount={5}>
                <li>a</li>
            </SummaryCardList>
        );
        expect(screen.getByRole('list').className).toContain(
            summaryGridColumnsClass(5)
        );
    });
});
