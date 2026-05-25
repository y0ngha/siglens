import {
    ET_MARKET_HOURS_DISPLAY,
    KST_EDT_HOURS_DISPLAY,
    KST_EST_HOURS_DISPLAY,
} from '@/shared/lib/options/marketHoursDisplay';

describe('ET_MARKET_HOURS_DISPLAY', () => {
    it('shows ET regular session hours', () => {
        expect(ET_MARKET_HOURS_DISPLAY).toBe('ET 9:30 ~ 16:00');
    });
});

describe('KST_EDT_HOURS_DISPLAY', () => {
    it('shows KST hours during EDT (summer time, +13h offset)', () => {
        // EDT: open 9:30 → KST 22:30, close 16:00 → KST 05:00
        expect(KST_EDT_HOURS_DISPLAY).toBe('22:30~05:00');
    });
});

describe('KST_EST_HOURS_DISPLAY', () => {
    it('shows KST hours during EST (standard time, +14h offset)', () => {
        // EST: open 9:30 → KST 23:30, close 16:00 → KST 06:00
        expect(KST_EST_HOURS_DISPLAY).toBe('23:30~06:00');
    });
});
