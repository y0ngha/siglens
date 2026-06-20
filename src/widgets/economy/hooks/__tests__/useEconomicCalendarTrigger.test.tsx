const { ensureEconomicCalendarAction, ensureEconomicEventsAnalyzedAction } =
    vi.hoisted(() => ({
        ensureEconomicCalendarAction: vi.fn(),
        ensureEconomicEventsAnalyzedAction: vi.fn(),
    }));

vi.mock('@/entities/economy/actions', () => ({
    ensureEconomicCalendarAction,
    ensureEconomicEventsAnalyzedAction,
}));

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { useEconomicCalendarTrigger } from '../useEconomicCalendarTrigger';

function Probe() {
    useEconomicCalendarTrigger();
    return null;
}

describe('useEconomicCalendarTrigger', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        ensureEconomicCalendarAction.mockResolvedValue(undefined);
        ensureEconomicEventsAnalyzedAction.mockResolvedValue(undefined);
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
        ensureEconomicCalendarAction.mockRejectedValue(new Error('boom'));
        expect(() => render(<Probe />)).not.toThrow();
    });

    it('also fires the analysis ensure once on mount', () => {
        render(<Probe />);
        expect(ensureEconomicEventsAnalyzedAction).toHaveBeenCalledOnce();
    });

    it('swallows a rejected ensureEconomicEventsAnalyzedAction without throwing', () => {
        vi.mocked(ensureEconomicEventsAnalyzedAction).mockRejectedValue(
            new Error('analysis down')
        );
        expect(() => render(<Probe />)).not.toThrow();
    });
});
