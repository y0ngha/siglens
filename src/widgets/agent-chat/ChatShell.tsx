'use client';

/**
 * AI 채팅 화면의 최상위 셸 — 레일 대화 목록 상태를 소유하고, 대화 세션(`ChatSession`)을
 * 새 대화 때 다시 시작할 수 있게 key로 감싼다.
 */
import { useState } from 'react';
import type {
    ChatMessageView,
    ConversationListItem,
} from '@/entities/chat-conversation/model';
import type { PendingSuggestions } from './EmptyState';
import { useConversationList } from './hooks/useConversationList';
import { ChatSession } from './shell/ChatSession';

interface Props {
    readonly conversationId: string | null;
    readonly initialMessages: ChatMessageView[];
    readonly conversations: ConversationListItem[];
    readonly signedIn: boolean;
    readonly localePrefix: string;
    readonly siteUrl: string;
    readonly currentPath: string;
    /** AI-generated suggestions for this hour (spec §4-3), still in flight; `null`/undefined falls back to `EmptyState`'s static six. */
    readonly suggestions?: PendingSuggestions | null;
    /** Question prefilled from an entry link (`?q=`); never sent automatically. */
    readonly initialDraft?: string;
}

/**
 * 목록은 세션 밖에 둔다 — 새 대화로 세션을 다시 만들어도 레일 목록(방금 만든 대화 포함)은
 * 그대로다. 다시 시작한 세션은 진입 링크의 `?q=` 초안을 다시 채우지 않는다(이미 쓴 질문이다).
 */
export function ChatShell({
    conversationId,
    initialMessages,
    conversations,
    initialDraft,
    ...rest
}: Props) {
    const list = useConversationList(conversations);
    const [sessionIndex, setSessionIndex] = useState(0);
    const isFirstSession = sessionIndex === 0;
    return (
        <ChatSession
            key={sessionIndex}
            {...rest}
            conversationId={isFirstSession ? conversationId : null}
            initialMessages={isFirstSession ? initialMessages : []}
            initialDraft={isFirstSession ? initialDraft : undefined}
            conversationItems={list.items}
            onConversationCreated={list.addCreated}
            onConversationRenamed={list.rename}
            onConversationDeleted={list.remove}
            onRestart={() => setSessionIndex(index => index + 1)}
        />
    );
}
