import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CryptoShowcase } from '../CryptoShowcase';

describe('CryptoShowcase', () => {
    it('renders links to popular crypto symbol pages', () => {
        render(<CryptoShowcase />);
        const btc = screen.getByRole('link', { name: /BTCUSD/ });
        expect(btc).toHaveAttribute('href', '/BTCUSD');
    });

    it('renders exactly 12 crypto chip links (CRYPTO_SHOWCASE_COUNT cap)', () => {
        render(<CryptoShowcase />);
        // POPULAR_CRYPTOS has 15 entries; the component slices to the first 12.
        // Asserting the exact count pins the cap so a POPULAR_CRYPTOS addition
        // or a slice-boundary change would fail the test immediately.
        const links = screen.getAllByRole('link');
        expect(links).toHaveLength(12);
        // The 13th entry in POPULAR_CRYPTOS is LTCUSD — it must not be rendered.
        expect(screen.queryByRole('link', { name: /LTCUSD/ })).toBeNull();
    });
});
