import { notFound } from 'next/navigation';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { getConversationAction } from '@/entities/chat-conversation/actions/getConversationAction';
import { listConversationsAction } from '@/entities/chat-conversation/actions/listConversationsAction';
import { enterLocale } from '@/shared/lib/enterLocale';
import { SITE_URL } from '@/shared/lib/seo';
import { ChatShell } from '@/widgets/agent-chat/ChatShell';
import { maybeHandoffRedirect } from '../../_lib/handoffRedirect';
import { localePrefixOf } from '../../_lib/localePrefix';

/**
 * 여기에도 의도적으로 `loading.tsx`가 없다. 레일은 클라이언트 전환으로 대화를 바꾸며 이
 * 페이지가 준비될 때까지 현재 화면을 유지하는데, 라우트 스켈레톤이 있으면 전환마다 깜빡임으로
 * 바뀐다. 직접 진입은 아래의 빠른 두 읽기만 기다린다.
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
    const locale = enterLocale(raw);
    await maybeHandoffRedirect(locale, `/c/${id}`, await searchParams);
    const user = await getCurrentUser();
    if (!user) notFound();
    const [conversation, conversations] = await Promise.all([
        getConversationAction(id),
        listConversationsAction(),
    ]);
    if (!conversation) notFound();
    const localePrefix = localePrefixOf(locale);
    return (
        <ChatShell
            // 대화마다 인스턴스를 하나씩 둔다. 레일이 클라이언트 전환으로 대화를 바꾸는데
            // ChatShell/useAgentStream은 상태(대화 기록·대화 id·사이드바 목록)를 마운트 때
            // 한 번만 시드하므로, 라우터의 세그먼트 키가 다시 마운트해 주길 기대하지 않고
            // key로 새 인스턴스를 보장한다.
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
