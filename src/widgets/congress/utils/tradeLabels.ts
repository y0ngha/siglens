/**
 * Catalog-key and class lookups for the enum columns of the trades table.
 *
 * Empty-string keys are sentinels for "render no badge"; callers must test them
 * BEFORE translating, because `t('')` returns a truthy fallback string rather
 * than an empty value.
 */
import type {
    Chamber,
    CongressOwner,
    CongressTradeSide,
} from '@y0ngha/siglens-core';

/** `shared.enumLabel` key per chamber. */
export const CHAMBER_LABEL: Record<Chamber, string> = {
    senate: 'chamber.senate',
    house: 'chamber.house',
};

/** `shared.enumLabel` key per side; `unknown` is the no-badge sentinel. */
export const SIDE_LABEL: Record<CongressTradeSide, string> = {
    buy: 'tradeSide.buy',
    sell: 'tradeSide.sell',
    unknown: '',
};

/** Text colour per side (WCAG AA success/danger tokens). */
export const SIDE_CLASS: Record<CongressTradeSide, string> = {
    buy: 'text-ui-success-text',
    sell: 'text-ui-danger-text',
    unknown: 'text-secondary-400',
};

/** Background tint per side; `unknown` has no badge so no tint. */
export const SIDE_BG_CLASS: Record<CongressTradeSide, string> = {
    buy: 'bg-ui-success/10',
    sell: 'bg-ui-danger/10',
    unknown: '',
};

/** `shared.enumLabel` key per owner; `unknown` (undisclosed) is the no-badge sentinel. */
export const OWNER_LABEL: Record<CongressOwner, string> = {
    self: 'owner.self',
    spouse: 'owner.spouse',
    joint: 'owner.joint',
    child: 'owner.child',
    unknown: '',
};

/** Chamber badge colours — senate is highlighted, house stays neutral. */
export const CHAMBER_BADGE_CLASS: Record<Chamber, string> = {
    senate: 'bg-primary-500/10 text-primary-400',
    house: 'bg-secondary-700 text-secondary-300',
};
