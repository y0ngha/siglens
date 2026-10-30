import {
    buildExpirationTabs,
    findActiveTabIndex,
} from '@/widgets/options/utils/expirationTabs';
import type { ExpirationSlotKey, SlotMapping } from '@y0ngha/siglens-core';

const LABELS: Record<ExpirationSlotKey, string> = {
    '0D': 'Today',
    '1W': '1 week',
    '2W': '2 weeks',
    '1M': '1 month',
    '2M': '2 months',
    '3M': '3 months',
    '6M': '6 months',
};

const SLOTS: SlotMapping[] = [
    {
        slot: { key: '1W', label: '1주', targetDays: 7 },
        expirationDate: '2025-06-20',
    },
    {
        slot: { key: '1M', label: '1개월', targetDays: 30 },
        expirationDate: '2025-07-18',
    },
];

describe('buildExpirationTabs', () => {
    it('builds one tab per slot with a month-day sub label, then an "all" tab', () => {
        expect(buildExpirationTabs(SLOTS, LABELS, 'All')).toEqual([
            { key: '1W', label: '1 week', value: '2025-06-20', sub: '06-20' },
            { key: '1M', label: '1 month', value: '2025-07-18', sub: '07-18' },
            { key: 'all', label: 'All', value: 'all' },
        ]);
    });

    it('falls back to the core label for a slot key missing from the catalog', () => {
        const unknown = {
            slot: { key: '9Y', label: '9년', targetDays: 3000 },
            expirationDate: '2035-01-19',
        } as unknown as SlotMapping;
        const [tab] = buildExpirationTabs([unknown], LABELS, 'All');
        expect(tab?.label).toBe('9년');
    });

    it('returns only the "all" tab for no slots', () => {
        expect(buildExpirationTabs([], LABELS, 'All')).toEqual([
            { key: 'all', label: 'All', value: 'all' },
        ]);
    });
});

describe('findActiveTabIndex', () => {
    const tabs = buildExpirationTabs(SLOTS, LABELS, 'All');

    it('returns the index of the matching value', () => {
        expect(findActiveTabIndex(tabs, '2025-07-18')).toBe(1);
        expect(findActiveTabIndex(tabs, 'all')).toBe(2);
    });

    it('falls back to the first tab when nothing matches', () => {
        expect(findActiveTabIndex(tabs, '1999-01-01')).toBe(0);
    });
});
