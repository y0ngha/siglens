import { periodYears } from '../../utils/periodYears';

describe('periodYears', () => {
    it.each([
        ['2024-11-01', '2026-11-02', 2],
        ['2024-11-01', '2025-04-01', 1],
        ['2024-01-01', '2026-08-01', 3],
        ['2025-01-01', '2025-01-02', 1],
        ['bad', '2025-01-01', 1],
    ])('%s → %s = %d년', (start, end, expected) => {
        expect(periodYears(start, end)).toBe(expected);
    });
});
