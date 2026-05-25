import { render } from '@testing-library/react';

import { CurrentYear } from '../CurrentYear';

describe('CurrentYear', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2025-06-15'));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('renders the current year', () => {
        const { container } = render(<CurrentYear />);

        expect(container.textContent).toBe('2025');
    });
});
