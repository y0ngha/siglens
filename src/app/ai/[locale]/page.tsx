import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getAgentSuggestions } from '@/entities/agent-suggestions/api';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { listConversationsAction } from '@/entities/chat-conversation/actions';
import { DrizzlePortfolioRepository } from '@/entities/portfolio/api';
import { getDatabaseClient } from '@/shared/db/client';
import {
    DEFAULT_LOCALE,
    isLocale,
    localePath,
    type Locale,
} from '@/shared/i18n/locales';
import { SITE_URL } from '@/shared/lib/seo';
import { JsonLd } from '@/shared/ui/JsonLd';
import { ChatShell } from '@/widgets/agent-chat';
import {
    buildAiHomeJsonLd,
    buildAiHomeMetadata,
    type AiSeoCopy,
} from './aiSeo';
import { maybeHandoffRedirect } from './handoffRedirect';

/**
 * Deliberately no `loading.tsx` for this route. With one, the streamed
 * response's visible HTML was only the `ChatSkeleton` — the whole landing
 * body (guide, FAQ, examples) sat in a hidden `<div hidden id="S:…">` chunk
 * that JS swapped in later, so non-JS crawlers and `curl` only ever saw a
 * skeleton (verified 2026-09-14 on production). The remaining awaits below
 * (session, conversation list, SEO copy) are fast; the slow part (AI
 * suggestions, LLM up to 8s) streams inside `EmptyState`'s own Suspense
 * boundary instead.
 */
export const dynamic = 'force-dynamic';

/** Entry links from siglens.io prefill the composer with `?q=`. */
const DRAFT_MAX_CHARS = 500;
function draftFrom(
    sp: Record<string, string | string[] | undefined>
): string | undefined {
    return typeof sp.q === 'string' && sp.q.trim()
        ? sp.q.trim().slice(0, DRAFT_MAX_CHARS)
        : undefined;
}

async function seoCopy(locale: Locale): Promise<AiSeoCopy> {
    const t = await getTranslations({ locale, namespace: 'app.ai' });
    return {
        title: t('seo.title'),
        description: t('seo.description'),
        ogLabel: t('seo.ogLabel'),
    };
}

export async function generateMetadata({
    params,
}: {
    readonly params: Promise<{ locale: string }>;
}): Promise<Metadata> {
    const { locale: raw } = await params;
    const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
    return buildAiHomeMetadata(locale, await seoCopy(locale));
}

/**
 * AI-generated empty-screen suggestions (spec §4-3) — portfolio symbols feed
 * the prompt exactly like the chat turn itself does in `stream/route.ts`.
 * Guests never reach this (no `user`), so they always get the static
 * fallback `EmptyState` already renders.
 */
async function loadSuggestions(
    userId: string,
    locale: Locale
): Promise<string[] | null> {
    const portfolioSymbols = (
        await new DrizzlePortfolioRepository(getDatabaseClient().db).findByUser(
            userId
        )
    ).map(h => h.symbol);
    return getAgentSuggestions({ locale, userId, portfolioSymbols });
}

export default async function AiHomePage({
    params,
    searchParams,
}: {
    readonly params: Promise<{ locale: string }>;
    readonly searchParams: Promise<
        Record<string, string | string[] | undefined>
    >;
}) {
    const { locale: raw } = await params;
    const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
    setRequestLocale(locale);
    const sp = await searchParams;
    await maybeHandoffRedirect(locale, '/', sp);
    const user = await getCurrentUser();
    // Suggestions are handed down unawaited: a cache miss generates them with an
    // LLM (up to 8s), and awaiting here held back the whole landing — the body then
    // streamed in a hidden chunk behind a skeleton, which non-JS crawlers never see.
    const suggestions = user
        ? loadSuggestions(user.id, locale).catch(error => {
              console.error('[AiHomePage] loadSuggestions failed:', error);
              return null;
          })
        : null;
    const [conversations, copy] = await Promise.all([
        user ? listConversationsAction() : Promise.resolve([]),
        seoCopy(locale),
    ]);
    const localePrefix = localePath(locale, '').replace(/\/$/, '');
    return (
        <>
            <JsonLd data={buildAiHomeJsonLd(locale, copy)} />
            <ChatShell
                conversationId={null}
                initialMessages={[]}
                conversations={conversations}
                signedIn={user !== null}
                localePrefix={localePrefix}
                siteUrl={SITE_URL}
                currentPath={`${localePrefix}/`}
                suggestions={suggestions}
                initialDraft={draftFrom(sp)}
            />
        </>
    );
}
