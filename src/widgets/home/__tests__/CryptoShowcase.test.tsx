import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CryptoShowcase } from '../CryptoShowcase';

describe('CryptoShowcase', () => {
    it('renders links to popular crypto symbol pages', () => {
        render(<CryptoShowcase />);
        const btc = screen.getByRole('link', { name: /BTCUSD/ });
        expect(btc).toHaveAttribute('href', '/BTCUSD');
    });
});
