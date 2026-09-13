/** Hosts served by the SiglensAI subtree. Port-suffixed dev host is stripped before matching. */
export const AI_HOSTS: ReadonlySet<string> = new Set([
    'ai.siglens.io',
    'ai.localhost',
]);
export const AI_SITE_URL =
    process.env.NEXT_PUBLIC_AI_SITE_URL ?? 'https://ai.siglens.io';

/**
 * SiglensAI home for a locale, optionally with a question prefilled in the
 * composer (`?q=`). The question is never sent on its own — the user still
 * presses send — so an entry link can't spend anyone's daily turns.
 */
export function aiAskUrl(localePrefixPath: string, question?: string): string {
    const base = `${AI_SITE_URL}${localePrefixPath}`;
    return question ? `${base}?q=${encodeURIComponent(question)}` : base;
}

export function isAiHost(hostHeader: string | null): boolean {
    if (!hostHeader) return false;
    const host = hostHeader.toLowerCase().split(':')[0] ?? '';
    return AI_HOSTS.has(host);
}
