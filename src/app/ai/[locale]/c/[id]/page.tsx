import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import {
    getConversationAction,
    listConversationsAction,
} from '@/entities/chat-conversation/actions';
import { DEFAULT_LOCALE, isLocale, localePath } from '@/shared/i18n/locales';
import { SITE_URL } from '@/shared/lib/seo';
import { ChatShell } from '@/widgets/agent-chat';
import { maybeHandoffRedirect } from '../../handoffRedirect';

/**
 * No `loading.tsx` here on purpose. The rail switches conversations with a
 * client transition that keeps the current screen until this page is ready, and
 * a route-level skeleton would replace that with a flash on every switch
 * (2026-09-15 사용자 요청). Direct loads just wait for the two fast reads below.
 */
export const dynamic = 'force-dynamic';

export default async function ConversationPage({
    params,
    searchParams,
}: {
    readonly params: Promise<{ locale: string; id: string }>;
    readonly searchParams: Promise<
        Record<string, string | string[] | undefined>
    >;
}) {
    const { locale: raw, id } = await params;
    const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
    setRequestLocale(locale);
    await maybeHandoffRedirect(locale, `/c/${id}`, await searchParams);
    const user = await getCurrentUser();
    if (!user) notFound();
    const [conversation, conversations] = await Promise.all([
        getConversationAction(id),
        listConversationsAction(),
    ]);
    if (!conversation) notFound();
    const localePrefix = localePath(locale, '').replace(/\/$/, '');
    return (
        <ChatShell
            // One instance per conversation. The rail now switches conversations
            // with a client transition, and ChatShell/useAgentStream seed their
            // state (transcript, conversation id, sidebar list) once on mount —
            // the key guarantees a fresh instance instead of relying on the
            // router's segment keys to remount it.
            key={conversation.id}
            conversationId={conversation.id}
            initialMessages={conversation.messages}
            conversations={conversations}
            signedIn
            localePrefix={localePrefix}
            siteUrl={SITE_URL}
            currentPath={`${localePrefix}/c/${id}`}
        />
    );
}
