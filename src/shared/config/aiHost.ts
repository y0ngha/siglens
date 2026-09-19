/** Hosts served by the SiglensAI subtree. Port-suffixed dev host is stripped before matching. */
export const AI_HOSTS: ReadonlySet<string> = new Set([
    'ai.siglens.io',
    'ai.localhost',
]);
/**
 * Public, indexable pages of the ai host: the sitemap (`proxy.ts`) and the
 * page metadata (`app/ai/[locale]/aiSeo.ts`) both read this list, so a page
 * cannot be indexable without being in the sitemap or the other way round.
 * Conversations (`/c/*`) are never here.
 */
export const AI_INDEXABLE_PATHS = ['/', '/about'] as const;
export type AiIndexablePath = (typeof AI_INDEXABLE_PATHS)[number];

export const AI_SITE_URL =
    process.env.NEXT_PUBLIC_AI_SITE_URL ?? 'https://ai.siglens.io';

/** Title, description and OG label for an ai-host page's metadata. */
export interface AiSeoCopy {
    readonly title: string;
    readonly description: string;
    readonly ogLabel: string;
}

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
