'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { Drawer } from 'vaul';
import type { ChatMessageView } from '@/entities/chat-conversation';
import type { ConversationListItem } from '@/entities/chat-conversation/actions';
import {
    useAgentStream,
    type AgentClientErrorCode,
} from '@/features/agent-chat';
import { useHideOnScrollDown } from '@/widgets/layout';
import { useOnClickOutside } from '@/shared/hooks/useOnClickOutside';
import { cn } from '@/shared/lib/cn';
import { Composer } from './Composer';
import { AGENT_ERROR_RETRYABLE } from './errorCopy';
import { EmptyState, type PendingSuggestions } from './EmptyState';
import { GUEST_TURNS_PER_DAY } from './guestTurnLimit';
import { MenuIcon } from './icons';
import { loginHref } from './loginHref';
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
    /** AI-generated suggestions for this hour (spec §4-3), still in flight; `null`/undefined falls back to `EmptyState`'s static six. */
    readonly suggestions?: PendingSuggestions | null;
    /** Question prefilled from an entry link (`?q=`); never sent automatically. */
    readonly initialDraft?: string;
}

export function ChatShell({
    conversationId,
    initialMessages,
    conversations,
    signedIn,
    localePrefix,
    siteUrl,
    currentPath,
    suggestions,
    initialDraft,
}: Props) {
    const t = useTranslations('widgets.agent-chat');
    const [drawerOpen, setDrawerOpen] = useState(false);
    /**
     * The sidebar list is client state seeded from the server, not re-read with
     * `router.refresh()`. `replaceState` moves the URL to `/c/<id>`, a DIFFERENT
     * route segment than the page that rendered this shell, so a refresh makes Next
     * swap in the `/c/[id]` tree: its `loading.tsx` skeleton flashes over a
     * conversation that was already on screen, and a refresh mid-stream would also
     * unmount this shell and abort the turn. Every change the list needs is known
     * here already — the created conversation's id and title arrive on the stream,
     * rename/delete come from the rail — so apply them locally instead.
     */
    const [conversationItems, setConversationItems] = useState(conversations);
    const drawerRef = useRef<HTMLDivElement>(null);
    const drawerTriggerRef = useRef<HTMLButtonElement>(null);
    // The drawer is non-modal (a modal vaul drawer trapped focus away from mobile
    // inputs), and non-modal vaul ignores presses outside it — so close it here.
    // The trigger is excluded: its own click toggles the drawer open.
    useOnClickOutside(
        [drawerRef, drawerTriggerRef],
        () => setDrawerOpen(false),
        {
            enabled: drawerOpen,
        }
    );
    // Same hook as the site header (AuthSessionHeaderClient) so the header and
    // this bar leave and return together on a phone.
    const chromeHidden = useHideOnScrollDown();
    const stream = useAgentStream({
        conversationId,
        initialMessages,
        guest: !signedIn,
        onConversationCreated: (id, title) => {
            window.history.replaceState(null, '', `${localePrefix}/c/${id}`);
            setConversationItems(items => [
                { id, title, lastMessageAt: new Date().toISOString() },
                ...items.filter(item => item.id !== id),
            ]);
        },
    });

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

    const login = loginHref(siteUrl, localePrefix, currentPath);
    const sidebar = (
        <Sidebar
            items={conversationItems}
            onRenamed={(id, title) =>
                setConversationItems(items =>
                    items.map(item =>
                        item.id === id ? { ...item, title } : item
                    )
                )
            }
            onDeleted={id =>
                setConversationItems(items =>
                    items.filter(item => item.id !== id)
                )
            }
            activeId={stream.conversationId}
            localePrefix={localePrefix}
            signedIn={signedIn}
            loginHref={login}
            siteUrl={siteUrl}
            onNavigate={() => setDrawerOpen(false)}
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
        turn_limit: signedIn
            ? t('ChatShell.errorTurnLimit')
            : t('ChatShell.errorTurnLimitGuest', { n: GUEST_TURNS_PER_DAY }),
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
    /** A guest out of turns has one way forward, and it is not "retry". */
    const offerLogin = !signedIn && errorCode === 'turn_limit';
    const activeTitle =
        conversationItems.find(c => c.id === stream.conversationId)?.title ??
        '';
    return (
        <div className="flex min-h-[calc(100dvh-3.5rem)]">
            {/* Pinned under the sticky site header at viewport height: a long
                conversation list scrolls inside the rail instead of stretching
                the page (which pushed the landing hero below the fold). */}
            <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-64 shrink-0 self-start border-r border-secondary-700 bg-secondary-950 lg:block">
                {sidebar}
            </aside>
            <Drawer.Root
                open={drawerOpen}
                onOpenChange={setDrawerOpen}
                direction="left"
                modal={false}
            >
                <Drawer.Portal>
                    <Drawer.Content
                        ref={drawerRef}
                        id="agent-chat-sidebar-drawer"
                        className="fixed inset-y-0 left-0 z-[60] w-72 border-r border-secondary-700 bg-secondary-950"
                    >
                        <Drawer.Title className="sr-only">
                            {t('ChatShell.9a7569')}
                        </Drawer.Title>
                        {sidebar}
                    </Drawer.Content>
                </Drawer.Portal>
            </Drawer.Root>
            <div className="flex min-w-0 flex-1 flex-col">
                {/* Sidebar is desktop-only (`aside` above); mobile opens it in the
                    vaul drawer instead. The shared main `Header` above this shell
                    already carries the site chrome, so this bar's only job is the
                    drawer trigger + the active conversation's title. */}
                <div
                    data-scroll-chrome=""
                    // `chromeHidden` only ever comes back `true` below `lg`
                    // (`useHideOnScrollDown`'s own media-query gate), so
                    // `inert` here never fires on a desktop viewport — this
                    // bar is `lg:hidden` there anyway. See Header.tsx for the
                    // same pattern on the site header.
                    inert={chromeHidden}
                    className={cn(
                        // Sticky under the site header (h-14) so the drawer trigger stays
                        // reachable mid-conversation; slides up with the header while
                        // scrolling down (11 + 14 = 6.25rem clears both).
                        'sticky top-14 z-40 flex h-11 items-center gap-2 border-b border-secondary-700 bg-secondary-900 px-2 transition-transform duration-200 motion-reduce:transition-none lg:hidden',
                        chromeHidden && '-translate-y-[6.25rem]'
                    )}
                >
                    <button
                        ref={drawerTriggerRef}
                        type="button"
                        onClick={() => setDrawerOpen(true)}
                        // vaul unmounts the drawer content while closed, so the id only
                        // exists once open — a reference to a missing element is invalid ARIA.
                        aria-controls={
                            drawerOpen ? 'agent-chat-sidebar-drawer' : undefined
                        }
                        aria-expanded={drawerOpen}
                        className="inline-flex min-h-9 items-center gap-1.5 rounded px-2 text-sm text-secondary-200 hover:bg-secondary-800 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                    >
                        <MenuIcon className="size-4" />
                        {t('ChatShell.openConversations')}
                    </button>
                    <span className="truncate text-sm text-secondary-300">
                        {activeTitle}
                    </span>
                </div>
                {stream.messages.length === 0 ? (
                    <EmptyState
                        localePrefix={localePrefix}
                        signedIn={signedIn}
                        loginHref={login}
                        onPick={text => void stream.send(text)}
                        suggestions={suggestions}
                    />
                ) : (
                    <MessageList
                        // Remounts the transcript on an actual conversation
                        // switch, so its mount-only "jump to bottom
                        // instantly" effect fires exactly then (spec §3.9).
                        // Keyed off the ROUTE-level `conversationId` PROP,
                        // not `stream.conversationId` — a brand-new chat's
                        // first send assigns `stream.conversationId` mid-turn
                        // (the SSE `meta` frame, see `useAgentStream.ts`),
                        // and keying off that would remount MessageList
                        // right as the first answer starts streaming,
                        // breaking the anchor-on-send scroll for every
                        // conversation's first turn. The prop only changes
                        // on a real navigation to a different conversation.
                        key={conversationId}
                        messages={stream.messages}
                        streaming={stream.status === 'streaming'}
                        onRegenerate={() => void stream.regenerate()}
                        onEdit={(seq, text) => void stream.edit(seq, text)}
                        siteUrl={siteUrl}
                        localePrefix={localePrefix}
                    />
                )}
                {errorMessage && stream.error !== 'unauthenticated' ? (
                    <div className="px-4 pb-2">
                        <p
                            role="alert"
                            className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 rounded-lg border border-ui-danger bg-secondary-800 px-4 py-3 text-sm text-ui-danger-text"
                        >
                            <span className="min-w-0 break-words">
                                {errorMessage}
                            </span>
                            {offerLogin ? (
                                <a
                                    href={login}
                                    className="inline-flex min-h-9 shrink-0 items-center rounded-lg bg-primary-600 px-3 text-xs font-medium text-white hover:bg-primary-700 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                                >
                                    {t('ChatShell.loginCta')}
                                </a>
                            ) : errorRetryable ? (
                                <button
                                    type="button"
                                    onClick={() => void stream.retry()}
                                    className="inline-flex min-h-9 shrink-0 items-center rounded-lg border border-border-control px-3 text-xs font-medium text-secondary-100 hover:bg-secondary-700 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                                >
                                    {t('ChatShell.548fe0')}
                                </button>
                            ) : null}
                        </p>
                    </div>
                ) : null}
                {!signedIn && stream.messages.length > 0 ? (
                    // Guests can ask, but the transcript lives only in this tab —
                    // say so once, next to the one action that keeps it.
                    <p className="mx-auto w-full max-w-3xl px-4 pb-1 text-center text-xs text-secondary-400">
                        {t('ChatShell.guestNotice')}{' '}
                        <a
                            href={login}
                            className="font-medium text-primary-400 underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                        >
                            {t('ChatShell.loginCta')}
                        </a>
                    </p>
                ) : null}
                <Composer
                    disabled={false}
                    streaming={stream.status === 'streaming'}
                    remainingTurns={stream.remaining?.turns ?? null}
                    onSend={text => void stream.send(text)}
                    onStop={stream.stop}
                    initialValue={initialDraft}
                />
            </div>
        </div>
    );
}
