import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CompetitorCard } from '../CompetitorCard';

describe('CompetitorCard', () => {
    it('renders the label, diff, interval line and question count in one list item', () => {
        render(
            <ul>
                <CompetitorCard
                    label="vs Beta"
                    diffText="+0.123"
                    ciText="CI [+0.051, +0.198]"
                    verdictText="Ahead"
                    questionsText="40 shared questions"
                />
            </ul>
        );
        const item = screen.getByRole('listitem');
        expect(item.textContent).toBe(
            'vs Beta+0.123CI [+0.051, +0.198] | Ahead40 shared questions'
        );
    });

    it('hides the visual separator from assistive technology', () => {
        render(
            <ul>
                <CompetitorCard
                    label="vs Beta"
                    diffText="+0.123"
                    ciText="CI"
                    verdictText="Ahead"
                    questionsText="40"
                />
            </ul>
        );
        expect(screen.getByText('|').getAttribute('aria-hidden')).toBe('true');
    });
});
