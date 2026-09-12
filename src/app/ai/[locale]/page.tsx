import { setRequestLocale } from 'next-intl/server';
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
import { ChatShell } from '@/widgets/agent-chat';
import { maybeHandoffRedirect } from './handoffRedirect';

export const dynamic = 'force-dynamic';

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
    await maybeHandoffRedirect(locale, '/', await searchParams);
    const user = await getCurrentUser();
    const [conversations, suggestions] = await Promise.all([
        user ? listConversationsAction() : Promise.resolve([]),
        user ? loadSuggestions(user.id, locale) : Promise.resolve(null),
    ]);
    const localePrefix = localePath(locale, '').replace(/\/$/, '');
    return (
        <ChatShell
            conversationId={null}
            initialMessages={[]}
            conversations={conversations}
            signedIn={user !== null}
            localePrefix={localePrefix}
            siteUrl={SITE_URL}
            currentPath={`${localePrefix}/`}
            suggestions={suggestions}
        />
    );
}
