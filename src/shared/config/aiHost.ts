/** Hosts served by the SiglensAI subtree. Port-suffixed dev host is stripped before matching. */
export const AI_HOSTS: ReadonlySet<string> = new Set([
    'ai.siglens.io',
    'ai.localhost',
]);
export const AI_SITE_URL =
    process.env.NEXT_PUBLIC_AI_SITE_URL ?? 'https://ai.siglens.io';

export function isAiHost(hostHeader: string | null): boolean {
    if (!hostHeader) return false;
    const host = hostHeader.toLowerCase().split(':')[0] ?? '';
    return AI_HOSTS.has(host);
}
