'use client';

import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import type { ChatMessageView } from '@/entities/chat-conversation/model';
import type { ConversationListItem } from '@/entities/chat-conversation/actions/listConversationsAction';
import { useAgentStream } from '@/features/agent-chat/hooks/useAgentStream';
import { type AgentClientErrorCode } from '@/features/agent-chat/lib/errorCodes';
import { BELOW_LG_MEDIA_QUERY } from '@/shared/config/viewport';
import { useHideOnScrollDown } from '@/shared/hooks/useHideOnScrollDown';
import { useOnClickOutside } from '@/shared/hooks/useOnClickOutside';
import { cn } from '@/shared/lib/cn';
import { Composer } from './Composer';
import { AGENT_ERROR_RETRYABLE } from './errorCopy';
import { EmptyState, type PendingSuggestions } from './EmptyState';
import { GUEST_TURNS_PER_DAY } from './guestTurnLimit';
import { useMediaQuery } from './hooks/useMediaQuery';
import { MenuIcon } from '@/shared/ui/StrokeIcons';
import { loginHref } from './loginHref';
import { withoutSsoParam } from './utils/withoutSsoParam';
import { ConversationSkeleton } from './ConversationSkeleton';
import { Sidebar } from './Sidebar';

/** `MessageList`의 바깥 상자와 같은 크기 — 청크가 오는 동안 Composer가 튀지 않게 자리를 잡는다. */
const MESSAGE_LIST_SLOT = 'relative min-h-0 flex-1';

/**
 * 대화 본문은 메시지가 생긴 뒤에만 필요하다. `MessageList`는 마크다운
 * 렌더러(react-markdown + remark-gfm)와 도구 칩·스크롤 로직을 끌고 오므로, 빈 랜딩에서는
 * 첫 로드 JS에서 뺀다. SSR은 켜 둔다 — 저장된 대화(`/c/<id>`)는 서버 HTML에 본문이
 * 그대로 실리고 하이드레이션이 그 청크를 기다리는 동안 화면이 바뀌지 않는다.
 */
// `import()`를 이 자리에 그대로 둔다 — Next가 정적으로 읽어 SSR 때 청크 preload를 심는다.
const MessageList = dynamic(
    () => import('./MessageList').then(mod => mod.MessageList),
    { loading: () => <div className={MESSAGE_LIST_SLOT} /> }
);

/** 모바일 서랍(vaul). 데스크톱은 레일(`aside`)을 쓰므로 `lg` 미만에서만 불러온다. */
const SidebarDrawer = dynamic(
    () => import('./SidebarDrawer').then(mod => mod.SidebarDrawer),
    { ssr: false }
);

/** `requestIdleCallback`이 없는 브라우저(Safari)에서 첫 페인트 뒤로 미루는 지연. */
const PRELOAD_FALLBACK_MS = 2_000;

/** 위 `dynamic`과 같은 청크 — 번들러가 하나로 합친다. */
function loadMessageList(): Promise<unknown> {
    return import('./MessageList');
}

/** 빈 랜딩에서 첫 전송 전에 본문 청크를 미리 받아 둔다 — 브라우저가 한가할 때. */
function preloadMessageListWhenIdle(): () => void {
    if (
        typeof window.requestIdleCallback === 'function' &&
        typeof window.cancelIdleCallback === 'function'
    ) {
        // 예약한 쪽의 취소 함수를 잡아 둔다 — 정리 시점에 전역이 바뀌어도 짝이 맞는다.
        const cancel = window.cancelIdleCallback.bind(window);
        const id = window.requestIdleCallback(() => void loadMessageList());
        return () => cancel(id);
    }
    const id = setTimeout(() => void loadMessageList(), PRELOAD_FALLBACK_MS);
    return () => clearTimeout(id);
}

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

/** 대화 화면(`/c/<id>`, 로케일 접두사 포함 가능) href의 대화 id. 대화 화면이 아니면 null. */
function conversationIdOf(href: string): string | null {
    return /\/c\/([^/?#]+)/.exec(href)?.[1] ?? null;
}

/** 지금 열린 대화가 아닌 다른 대화로 가는가. */
function isOtherConversation(
    target: string | null,
    current: string | null
): boolean {
    return target !== null && target !== current;
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
     * 사이드바에서 **다른 대화**로 가는 중인가. 그동안 본문은 떠나온 대화 대신 골격을 그린다.
     * 다른 대화에 도착하면 이 셸이 대화별로 다시 마운트돼(`c/[id]/page.tsx`의 `key`) 값이
     * 저절로 풀린다. 같은 대화를 다시 누른 경우처럼 다시 마운트되지 않고 끝나는 이동은
     * 사이드바의 `onNavigate`(전환 종료)에서 푼다. 새 대화(`/`)로 가는 이동은 빈 화면이
     * 가벼워 골격을 그리지 않는다.
     */
    const [switchingConversation, setSwitchingConversation] = useState(false);
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
    const isBelowLg = useMediaQuery(BELOW_LG_MEDIA_QUERY);
    // 서랍이 열린 채 `lg` 이상으로 넓어지면 서랍은 언마운트되지만(레일이 대신한다)
    // `drawerOpen`이 남아 버튼의 `aria-expanded`가 거짓말을 하고, 다시 좁히면 서랍이
    // 저절로 열린다. 렌더 중에 바로 닫는다(이번 렌더의 값에서 나온 상태 조정 — effect 불필요).
    if (!isBelowLg && drawerOpen) setDrawerOpen(false);
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

    // `?sso=none` is the server's "handoff already ran" signal (`proxy.ts` also
    // remembers it in a cookie) and means nothing to the visitor. Left in the
    // address bar it rides along on reload, share and bookmark. Only `sso` goes —
    // `q` and the ad click ids must survive.
    useEffect(() => {
        const cleaned = withoutSsoParam(window.location.href);
        if (cleaned !== null) {
            window.history.replaceState(window.history.state, '', cleaned);
        }
    }, []);

    // 빈 랜딩: 첫 전송 때 본문 청크를 기다리며 빈 자리가 보이지 않도록 미리 받아 둔다.
    // 첫 로드(파싱·실행) 경로에서는 빠지고, 내려받기만 유휴 시간으로 미룬다.
    const hasMessages = stream.messages.length > 0;
    useEffect(() => {
        if (hasMessages) return;
        return preloadMessageListWhenIdle();
    }, [hasMessages]);

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
            onNavigationStart={href =>
                // 지금 열린 대화를 다시 누른 것이면 골격을 그리지 않는다 — 보던 대화를
                // 지웠다가 같은 대화로 되돌리는 깜빡임이 된다.
                setSwitchingConversation(
                    isOtherConversation(conversationIdOf(href), conversationId)
                )
            }
            onNavigate={() => {
                setDrawerOpen(false);
                setSwitchingConversation(false);
            }}
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
            {isBelowLg ? (
                <SidebarDrawer
                    open={drawerOpen}
                    onOpenChange={setDrawerOpen}
                    contentRef={drawerRef}
                    title={t('ChatShell.9a7569')}
                >
                    {sidebar}
                </SidebarDrawer>
            ) : null}
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
                {switchingConversation ? (
                    <ConversationSkeleton />
                ) : !hasMessages ? (
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
                        onSend={text => void stream.send(text)}
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
                {!signedIn && hasMessages ? (
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
