import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HEADING_SUBSECTION } from '@/shared/lib/typographyStyles';
import { renderWithIntl } from '@/shared/test-utils/renderWithIntl';
import { QuoteIcon } from '@/shared/ui/StrokeIcons';
import { DataTileCard } from '../../ui/data/DataTileCard';

const TILE = {
    Icon: QuoteIcon,
    title: 'Options',
    body: 'Reads expectations.',
    scope: 'US stocks',
    href: '/NVDA/options',
    exampleLabel: 'See NVIDIA Options',
};

describe('DataTileCard', () => {
    it('styles the tile title with the subsection token', () => {
        renderWithIntl(<DataTileCard tile={TILE} />);
        const heading = screen.getByRole('heading', { level: 3 });
        for (const token of HEADING_SUBSECTION.split(' ')) {
            expect(heading).toHaveClass(token);
        }
    });

    it('links into the ticker tab with the example label', () => {
        renderWithIntl(<DataTileCard tile={TILE} />);
        expect(
            screen.getByRole('link', { name: 'See NVIDIA Options' })
        ).toHaveAttribute('href', '/NVDA/options');
    });
});
