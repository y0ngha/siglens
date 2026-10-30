import { canShareNatively, isShareAbort } from '@/shared/lib/share';

/** What the caller must still show after `deliverShare` settles. */
export type ShareDelivery = 'done' | 'sheet';

/** Text and link handed to the OS share sheet (or the fallback sheet). */
export interface SharePayload {
    title: string;
    text: string;
    url: string;
}

/**
 * Hands the link to the OS share sheet on touch devices and reports whether
 * the in-app ShareSheet is still needed: always on desktop, and after a native
 * share that failed for any reason other than the user dismissing it
 * (`AbortError`), so the link is never lost.
 */
export async function deliverShare(
    payload: SharePayload
): Promise<ShareDelivery> {
    if (!canShareNatively()) return 'sheet';
    try {
        await navigator.share(payload);
        return 'done';
    } catch (error) {
        return isShareAbort(error) ? 'done' : 'sheet';
    }
}
