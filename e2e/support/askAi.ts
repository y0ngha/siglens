import { expect, type Locator } from '@playwright/test';

/**
 * `NEXT_PUBLIC_AI_SITE_URL` under `.env.e2e` — the SIGLENS AI host the Ask-AI links point at
 * (same host the `ai` project in `playwright.config.ts` uses).
 */
export const E2E_AI_ORIGIN = 'http://ai.localhost:4300';

interface AskAiDestination {
    /** Path on the AI host: `/` for ko, `/en` for the `/en` locale. */
    readonly pathname: string;
    /** A fixed fragment of the prefilled question (the asset name varies). */
    readonly questionFragment: string;
}

/**
 * Asserts an Ask-AI link (floating or inline) opens a new tab on the AI host with the question
 * prefilled in `?q=` (never auto-sent, per `aiAskUrl`'s contract).
 */
export async function expectAskAiDestination(
    link: Locator,
    { pathname, questionFragment }: AskAiDestination
): Promise<void> {
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'nofollow noopener');

    const href = await link.getAttribute('href');
    expect(href).not.toBeNull();
    const url = new URL(href ?? '');
    expect(`${url.protocol}//${url.host}`).toBe(E2E_AI_ORIGIN);
    expect(url.pathname).toBe(pathname);
    expect(url.searchParams.get('q')).toContain(questionFragment);
}
