import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CryptoBadge } from '../ui/TickerAutocomplete';

describe('CryptoBadge', () => {
    it('renders a 코인 badge', () => {
        render(<CryptoBadge />);
        expect(screen.getByText('코인')).toBeInTheDocument();
    });
});
