import type { AnnouncedEventPoint } from '../../model';
import { buildKrIndicatorCards } from '../krIndicatorCards';

function point(
    overrides: Partial<AnnouncedEventPoint> = {}
): AnnouncedEventPoint {
    return {
        dateEt: '2026-01-03 00:00:00',
        event: 'Inflation Rate YoY (Jan)',
        actual: 3.2,
        previous: null,
        unit: '%',
        ...overrides,
    };
}

describe('buildKrIndicatorCards', () => {
    it('returns no cards for an empty history', () => {
        expect(buildKrIndicatorCards([])).toEqual([]);
    });

    it('ignores events outside the registry', () => {
        expect(
            buildKrIndicatorCards([point({ event: 'Unknown Event (Jan)' })])
        ).toEqual([]);
    });

    it('uses the last row of an indicator as the latest announcement', () => {
        const [card] = buildKrIndicatorCards([
            point({ actual: 3.2 }),
            point({ dateEt: '2026-02-03 00:00:00', actual: 2.8 }),
        ]);

        expect(card.meta.event).toBe('Inflation Rate YoY');
        expect(card.latest).toBe(2.8);
    });

    it('computes the change from the previous row, not the FMP previous field', () => {
        const [card] = buildKrIndicatorCards([
            point({ actual: 3 }),
            point({ dateEt: '2026-02-03 00:00:00', actual: 2.5, previous: 99 }),
        ]);

        expect(card.changeFromPrevious).toBe(-0.5);
    });

    it('leaves the change null with a single announcement', () => {
        const [card] = buildKrIndicatorCards([point()]);

        expect(card.changeFromPrevious).toBeNull();
    });

    it('dates the card by the KST calendar day of the UTC wall clock', () => {
        const [card] = buildKrIndicatorCards([
            point({ dateEt: '2026-02-02 15:00:00' }),
        ]);

        expect(card.latestDate).toBe('2026-02-03');
    });
});
