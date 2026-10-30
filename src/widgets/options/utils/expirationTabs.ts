/**
 * Pure tab model for the expiration selector: one tab per listed slot plus a
 * trailing "all" tab.
 */
import type { ExpirationSlotKey, SlotMapping } from '@y0ngha/siglens-core';
import type { OptionsExpirationSelector } from '@/shared/lib/types';

/** One selectable expiration chip. */
export interface ExpirationTab {
    key: string;
    label: string;
    /** Selection value forwarded to `onChange`. */
    value: OptionsExpirationSelector;
    /** Optional secondary label (month-day slice of the expiration). */
    sub?: string;
}

/**
 * Build the tab list. `slotLabels` is the localized label per slot key; a slot
 * key missing from it (an installed core newer than the build) falls back to
 * core's own label so the chip is never blank.
 */
export function buildExpirationTabs(
    slots: ReadonlyArray<SlotMapping>,
    slotLabels: Readonly<Record<ExpirationSlotKey, string>>,
    allLabel: string
): ExpirationTab[] {
    const slotTabs = slots.map(({ slot, expirationDate }) => ({
        key: slot.key,
        label: slotLabels[slot.key] ?? slot.label,
        value: expirationDate,
        sub: expirationDate.slice(5),
    }));
    return [...slotTabs, { key: 'all', label: allLabel, value: 'all' }];
}

/** Index of the tab matching `value`; falls back to the first tab. */
export function findActiveTabIndex(
    tabs: ReadonlyArray<ExpirationTab>,
    value: OptionsExpirationSelector
): number {
    return Math.max(
        tabs.findIndex(tab => tab.value === value),
        0
    );
}
