vi.mock('@/entities/economy/actions', () => ({
    ensureEconomicCalendarAction: vi.fn(),
}));

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { ensureEconomicCalendarAction } from '@/entities/economy/actions';
import { useEconomicCalendarTrigger } from '../useEconomicCalendarTrigger';

function Probe() {
    useEconomicCalendarTrigger();
    return null;
}

describe('useEconomicCalendarTrigger', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(ensureEconomicCalendarAction).mockResolvedValue(undefined);
    });

    it('fires the ensure action once on mount', () => {
        render(<Probe />);
        expect(ensureEconomicCalendarAction).toHaveBeenCalledOnce();
    });

    it('does not re-fire on re-render', () => {
        const { rerender } = render(<Probe />);
        rerender(<Probe />);
        expect(ensureEconomicCalendarAction).toHaveBeenCalledOnce();
    });

    it('swallows a rejected action without throwing', () => {
        vi.mocked(ensureEconomicCalendarAction).mockRejectedValue(
            new Error('boom')
        );
        expect(() => render(<Probe />)).not.toThrow();
    });
});
