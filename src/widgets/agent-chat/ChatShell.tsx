'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { Drawer } from 'vaul';
import { useRouter } from 'next/navigation';
import type { ChatMessageView } from '@/entities/chat-conversation';
import type { ConversationListItem } from '@/entities/chat-conversation/actions';
import {
    useAgentStream,
    type AgentClientErrorCode,
} from '@/features/agent-chat';
import { AiHeader, loginHref } from './AiHeader';
import { Composer } from './Composer';
import { AGENT_ERROR_RETRYABLE } from './errorCopy';
import { EmptyState } from './EmptyState';
import { MessageList } from './MessageList';
import { Sidebar } from './Sidebar';

interface Props {
    readonly conversationId: string | null;
    readonly initialMessages: ChatMessageView[];
    readonly conversations: ConversationListItem[];
    readonly signedIn: boolean;
    readonly localePrefix: string;
    readonly siteUrl: string;
    readonly currentPath: string;
}

export function ChatShell({
    conversationId,
    initialMessages,
    conversations,
    signedIn,
    localePrefix,
    siteUrl,
    currentPath,
}: Props) {
    const t = useTranslations('widgets.agent-chat');
    const router = useRouter();
    const [drawerOpen, setDrawerOpen] = useState(false);
    /**
     * `replaceState` moves the URL to `/c/<id>`, which is a DIFFERENT route segment
     * than the page that rendered this shell. Refreshing while the turn is still
     * streaming makes Next unmount this ChatShell and mount the `/c/[id]` one: the
     * stream hook's unmount cleanup aborts the in-flight request (the server sees the
     * client disconnect and logs `turn failed: aborted`) and the fresh instance
     * re-initializes from server rows that do not hold the answer yet — so the
     * streaming bubble disappears and no reply ever lands. Defer the refresh (which
     * exists to pull the new conversation into the sidebar list) until the turn
     * settles.
     */
    const pendingRefreshRef = useRef(false);
    const stream = useAgentStream({
        conversationId,
        initialMessages,
        onConversationCreated: id => {
            window.history.replaceState(null, '', `${localePrefix}/c/${id}`);
            pendingRefreshRef.current = true;
        },
    });
    useEffect(() => {
        if (stream.status === 'streaming' || !pendingRefreshRef.current) return;
        pendingRefreshRef.current = false;
        router.refresh();
    }, [stream.status, router]);

    // A session that expired mid-visit surfaces as a 401 on the stream route —
    // bounce through the same handoff flow the login CTA uses instead of
    // leaving the composer permanently disabled with a dead error banner.
    useEffect(() => {
        if (stream.error === 'unauthenticated') {
            window.location.href = loginHref(
                siteUrl,
                localePrefix,
                currentPath
            );
        }
    }, [stream.error, siteUrl, localePrefix, currentPath]);

    const sidebar = (
        <Sidebar
            items={conversations}
            activeId={stream.conversationId}
            localePrefix={localePrefix}
        />
    );

    /**
     * Copy for every code `POST /api/ai/chat/stream` can surface —
     * HTTP-stage (`invalid_body`…`disabled`, `stream/route.ts`) and
     * turn-stage (`AgentErrorCode`, spec §8, the SSE `error` frame).
     * `Record<AgentClientErrorCode, string>` (every key required) so a new
     * code lands as a `tsc` failure here instead of a silent fallback
     * message. Built inside the component (not hoisted) so each entry is a
     * real `t()` call the extractor can find — see `ChatShell.test.tsx` for
     * the per-code coverage check.
     */
    const errorMessageByCode: Record<AgentClientErrorCode, string> = {
        invalid_body: t('ChatShell.errorInvalidBody'),
        unauthenticated: t('ChatShell.errorUnauthenticated'),
        bot: t('ChatShell.errorBot'),
        not_found: t('ChatShell.errorNotFound'),
        conversation_limit: t('ChatShell.errorConversationLimit'),
        conversation_full: t('ChatShell.errorConversationFull'),
        disabled: t('ChatShell.errorDisabled'),
        server_busy: t('ChatShell.errorServerBusy'),
        turn_limit: t('ChatShell.errorTurnLimit'),
        premium_turn_limit: t('ChatShell.errorPremiumTurnLimit'),
        rate_limited: t('ChatShell.errorRateLimited'),
        server_error: t('ChatShell.errorServerError'),
        deadline: t('ChatShell.errorDeadline'),
        aborted: t('ChatShell.errorAborted'),
    };
    const errorCode = stream.error as AgentClientErrorCode | null;
    const errorMessage = errorCode
        ? (errorMessageByCode[errorCode] ?? t('ChatShell.errorGeneric'))
        : null;
    const errorRetryable = errorCode
        ? (AGENT_ERROR_RETRYABLE[errorCode] ?? true)
        : false;
    return (
        <div className="flex min-h-dvh">
            <aside className="hidden w-64 shrink-0 border-r border-border-control lg:block">
                {sidebar}
            </aside>
            <Drawer.Root
                open={drawerOpen}
                onOpenChange={setDrawerOpen}
                direction="left"
                modal={false}
            >
                <Drawer.Portal>
                    <Drawer.Content className="fixed inset-y-0 left-0 z-50 w-72 bg-secondary-900">
                        <Drawer.Title className="sr-only">
                            {t('ChatShell.9a7569')}
                        </Drawer.Title>
                        {sidebar}
                    </Drawer.Content>
                </Drawer.Portal>
            </Drawer.Root>
            <div className="flex min-w-0 flex-1 flex-col">
                <AiHeader
                    signedIn={signedIn}
                    siteUrl={siteUrl}
                    localePrefix={localePrefix}
                    currentPath={currentPath}
                    onOpenSidebar={() => setDrawerOpen(true)}
                />
                {stream.messages.length === 0 ? (
                    <EmptyState
                        signedIn={signedIn}
                        loginHref={loginHref(
                            siteUrl,
                            localePrefix,
                            currentPath
                        )}
                        onPick={text => void stream.send(text)}
                    />
                ) : (
                    <MessageList
                        messages={stream.messages}
                        streaming={stream.status === 'streaming'}
                        onRegenerate={() => void stream.regenerate()}
                        onEdit={(seq, text) => void stream.edit(seq, text)}
                    />
                )}
                {errorMessage && stream.error !== 'unauthenticated' ? (
                    <p
                        role="alert"
                        className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 text-sm text-ui-danger-text"
                    >
                        {errorMessage}
                        {errorRetryable ? (
                            <button
                                type="button"
                                onClick={() => void stream.retry()}
                                className="rounded border border-border-control px-2 py-0.5 text-xs text-secondary-200 focus-visible:ring-2 focus-visible:ring-primary-500"
                            >
                                {t('ChatShell.548fe0')}
                            </button>
                        ) : null}
                    </p>
                ) : null}
                <Composer
                    disabled={!signedIn}
                    streaming={stream.status === 'streaming'}
                    remainingTurns={stream.remaining?.turns ?? null}
                    onSend={text => void stream.send(text)}
                    onStop={stream.stop}
                />
            </div>
        </div>
    );
}
