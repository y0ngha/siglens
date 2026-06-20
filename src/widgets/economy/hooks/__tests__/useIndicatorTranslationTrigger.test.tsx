vi.mock('@/entities/economy/actions', () => ({
    ensureIndicatorTranslatedAction: vi.fn(),
}));

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import type { EconomicCalendarEvent } from '@y0ngha/siglens-core';
import { ensureIndicatorTranslatedAction } from '@/entities/economy/actions';
import { useIndicatorTranslationTrigger } from '../useIndicatorTranslationTrigger';

const ev = (event: string): EconomicCalendarEvent => ({
    date: '2026-06-13 08:30:00',
    event,
    impact: 'High',
    actual: null,
    estimate: 1,
    previous: 1,
    unit: '%',
});

interface ProbeProps {
    events: readonly EconomicCalendarEvent[];
    labels: Record<string, string>;
}

function Probe({ events, labels }: ProbeProps) {
    useIndicatorTranslationTrigger(events, labels);
    return null;
}

describe('useIndicatorTranslationTrigger', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(ensureIndicatorTranslatedAction).mockResolvedValue(undefined);
    });

    it('fires once per distinct unresolved base on mount', () => {
        const events = [
            ev('Totally Unknown Thing (Apr)'),
            ev('Another Mystery Index (May)'),
        ];
        render(<Probe events={events} labels={{}} />);
        expect(ensureIndicatorTranslatedAction).toHaveBeenCalledTimes(2);
        expect(ensureIndicatorTranslatedAction).toHaveBeenCalledWith(
            'Totally Unknown Thing'
        );
        expect(ensureIndicatorTranslatedAction).toHaveBeenCalledWith(
            'Another Mystery Index'
        );
    });

    it('dedupes multiple month variants of the same base into one call', () => {
        const events = [
            ev('Totally Unknown Thing (Apr)'),
            ev('Totally Unknown Thing (May)'),
        ];
        render(<Probe events={events} labels={{}} />);
        expect(ensureIndicatorTranslatedAction).toHaveBeenCalledTimes(1);
        expect(ensureIndicatorTranslatedAction).toHaveBeenCalledWith(
            'Totally Unknown Thing'
        );
    });

    it('does NOT call ensure for a name already resolved in labels', () => {
        const events = [ev('Some Obscure Index YoY (May)')];
        const labels = { 'Some Obscure Index YoY (May)': '어떤 지수 (5월)' };
        render(<Probe events={events} labels={labels} />);
        expect(ensureIndicatorTranslatedAction).not.toHaveBeenCalled();
    });

    it('does NOT call ensure for a dict-known name even when labels is empty', () => {
        // 'Nonfarm Payrolls' is in INDICATOR_NAME_KO — server resolved it;
        // if labels is empty (edge case), we still skip it because it's dict-covered.
        const events = [ev('Nonfarm Payrolls')];
        render(<Probe events={events} labels={{}} />);
        expect(ensureIndicatorTranslatedAction).not.toHaveBeenCalled();
    });

    it('does not re-fire on re-render', () => {
        const events = [ev('Totally Unknown Thing')];
        const { rerender } = render(<Probe events={events} labels={{}} />);
        rerender(<Probe events={events} labels={{}} />);
        expect(ensureIndicatorTranslatedAction).toHaveBeenCalledTimes(1);
    });

    it('swallows a rejected action without throwing', () => {
        vi.mocked(ensureIndicatorTranslatedAction).mockRejectedValue(
            new Error('boom')
        );
        const events = [ev('Totally Unknown Thing')];
        expect(() =>
            render(<Probe events={events} labels={{}} />)
        ).not.toThrow();
    });

    it('does nothing when all events are resolved in labels', () => {
        const events = [ev('Totally Unknown Thing (Apr)')];
        const labels = { 'Totally Unknown Thing (Apr)': '알 수 없는 것 (4월)' };
        render(<Probe events={events} labels={labels} />);
        expect(ensureIndicatorTranslatedAction).not.toHaveBeenCalled();
    });

    it('handles empty events array without error', () => {
        render(<Probe events={[]} labels={{}} />);
        expect(ensureIndicatorTranslatedAction).not.toHaveBeenCalled();
    });
});
