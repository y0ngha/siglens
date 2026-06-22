import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CryptoShowcase, CRYPTO_SHOWCASE_COUNT } from '../CryptoShowcase';

describe('CryptoShowcase', () => {
    it('renders links to popular crypto symbol pages', () => {
        render(<CryptoShowcase />);
        const btc = screen.getByRole('link', { name: /BTCUSD/ });
        expect(btc).toHaveAttribute('href', '/BTCUSD');
    });

    it('renders exactly CRYPTO_SHOWCASE_COUNT crypto chip links', () => {
        render(<CryptoShowcase />);
        // CryptoShowcase renders only the first CRYPTO_SHOWCASE_COUNT of POPULAR_CRYPTOS;
        // the remainder are sliced off. Adding entries to POPULAR_CRYPTOS does not change this cap.
        const links = screen.getAllByRole('link');
        expect(links).toHaveLength(CRYPTO_SHOWCASE_COUNT);
        // The 13th entry in POPULAR_CRYPTOS is LTCUSD — it must not be rendered.
        expect(screen.queryByRole('link', { name: /LTCUSD/ })).toBeNull();
    });
});
