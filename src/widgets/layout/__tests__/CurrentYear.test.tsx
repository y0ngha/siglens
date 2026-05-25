import { render } from '@testing-library/react';

import { CurrentYear } from '../CurrentYear';

describe('CurrentYear', () => {
    it('renders the current year', () => {
        const { container } = render(<CurrentYear />);

        expect(container.textContent).toBe(String(new Date().getFullYear()));
    });
});
