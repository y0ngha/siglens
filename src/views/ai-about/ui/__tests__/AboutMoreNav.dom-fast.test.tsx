import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AboutMoreNav } from '../more/AboutMoreNav';

const LINKS = [
    { href: 'https://siglens.io/market', label: 'US market' },
    { href: 'https://siglens.io/market/kr', label: 'Korean market' },
] as const;

describe('AboutMoreNav', () => {
    it('names the navigation landmark after its heading', () => {
        render(<AboutMoreNav title="More on SIGLENS" links={LINKS} />);
        expect(
            screen.getByRole('navigation', { name: 'More on SIGLENS' })
        ).toBeInTheDocument();
    });

    it('renders one link per entry with its href, in order', () => {
        render(<AboutMoreNav title="More on SIGLENS" links={LINKS} />);
        const nav = screen.getByRole('navigation', { name: 'More on SIGLENS' });
        const links = within(nav).getAllByRole('link');
        expect(links.map(link => link.textContent)).toEqual([
            'US market',
            'Korean market',
        ]);
        expect(links.map(link => link.getAttribute('href'))).toEqual([
            'https://siglens.io/market',
            'https://siglens.io/market/kr',
        ]);
    });
});
