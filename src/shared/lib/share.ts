const TWITTER_INTENT = 'https://twitter.com/intent/tweet';

export function buildTweetIntentUrl({
    text,
    shareUrl,
}: {
    text: string;
    shareUrl: string;
}): string {
    // URLSearchParams encodes spaces as '+', but Twitter's intent URL requires '%20' for spaces.
    const params = new URLSearchParams({ text, url: shareUrl });
    return `${TWITTER_INTENT}?${params.toString().replaceAll('+', '%20')}`;
}

/**
 * Returns true only when navigator.share is a function AND the pointer is coarse (mobile).
 * Returns false in SSR and on desktop.
 */
export function canShareNatively(): boolean {
    if (
        typeof navigator === 'undefined' ||
        typeof navigator.share !== 'function'
    )
        return false;
    if (
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function'
    ) {
        return window.matchMedia('(pointer: coarse)').matches;
    }
    return false;
}

export function isShareAbort(err: unknown): boolean {
    return err instanceof DOMException && err.name === 'AbortError';
}
