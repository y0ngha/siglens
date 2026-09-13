import { setRequestLocale } from 'next-intl/server';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { listConversationsAction } from '@/entities/chat-conversation/actions';
import { DEFAULT_LOCALE, isLocale, localePath } from '@/shared/i18n/locales';
import { SITE_URL } from '@/shared/lib/seo';
import { ChatShell } from '@/widgets/agent-chat';
import { maybeHandoffRedirect } from './handoffRedirect';

export const dynamic = 'force-dynamic';

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
    const conversations = user ? await listConversationsAction() : [];
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
        />
    );
}
