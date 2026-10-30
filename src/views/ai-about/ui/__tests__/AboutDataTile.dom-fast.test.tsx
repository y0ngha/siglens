import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HEADING_SUBSECTION } from '@/shared/lib/typographyStyles';
import { AboutDataTile } from '../data/AboutDataTile';

const TILE = {
    id: 'news',
    title: 'Tile title',
    body: 'Tile body',
    scope: 'Tile scope',
} as const;

describe('AboutDataTile', () => {
    it('renders the title as an h3 with the body and scope', () => {
        render(
            <ul>
                <AboutDataTile tile={TILE} />
            </ul>
        );
        const item = screen.getByRole('listitem');
        expect(
            screen.getByRole('heading', { level: 3, name: 'Tile title' })
        ).toBeInTheDocument();
        expect(item).toHaveTextContent('Tile body');
        expect(item).toHaveTextContent('Tile scope');
    });

    it('styles the title with the subsection token, a step below the section h2', () => {
        render(
            <ul>
                <AboutDataTile tile={TILE} />
            </ul>
        );
        const heading = screen.getByRole('heading', { level: 3 });
        expect(heading.className).toBe(HEADING_SUBSECTION);
    });
});
