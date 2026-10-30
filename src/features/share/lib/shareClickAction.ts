import type { ShareableStatus } from '../model/ShareableAnalysisContext';

/**
 * What a click on the share button does for each registration status:
 * explain why sharing is off, share the finished result, wait for the running
 * analysis, or ask before starting one.
 */
export type ShareClickAction = 'notice' | 'share' | 'wait' | 'confirm';

/** Click routing per status. `Record` keeps a new status from falling through silently. */
export const SHARE_CLICK_ACTION: Record<ShareableStatus, ShareClickAction> = {
    unavailable: 'notice',
    success: 'share',
    pending: 'wait',
    idle: 'confirm',
    error: 'confirm',
};
