'use client';

/**
 * 대화 세션 화면 — 스트림 하나를 소유하고 레일(데스크톱 `aside`·모바일 서랍), 대화 바, 본문
 * (빈 상태·골격·대화), 오류 배너, 입력창을 배치한다. `ChatShell`이 새 대화 때 key로 다시 마운트한다.
 */
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { ConversationListItem } from '@/entities/chat-conversation/actions/listConversationsAction';
import type { ChatMessageView } from '@/entities/chat-conversation/model';
import { useAgentStream } from '@/features/agent-chat/hooks/useAgentStream';
import { BELOW_LG_MEDIA_QUERY } from '@/shared/config/viewport';
import { useHideOnScrollDown } from '@/shared/hooks/useHideOnScrollDown';
import { useOnClickOutside } from '@/shared/hooks/useOnClickOutside';
import { Composer } from '../Composer';
import { ConversationSkeleton } from '../ConversationSkeleton';
import { EmptyState, type PendingSuggestions } from '../EmptyState';
import { useAgentErrorCopy } from '../hooks/useAgentErrorCopy';
import { useIdlePreload } from '../hooks/useIdlePreload';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useStripSsoParam } from '../hooks/useStripSsoParam';
import { Sidebar } from '../Sidebar';
import {
    conversationIdOf,
    isOtherConversation,
    livePath,
} from '../utils/conversationRoute';
import { loginHref } from '../utils/loginHref';
import { GuestNotice } from './GuestNotice';
import { MobileChatBar } from './MobileChatBar';
import { StreamErrorBanner } from './StreamErrorBanner';

/** `MessageList`의 바깥 상자와 같은 크기 — 청크가 오는 동안 Composer가 튀지 않게 자리를 잡는다. */
const MESSAGE_LIST_SLOT = 'relative min-h-0 flex-1';

/**
 * 대화 본문은 메시지가 생긴 뒤에만 필요하다. `MessageList`는 마크다운 렌더러(react-markdown +
 * remark-gfm)와 도구 칩·스크롤 로직을 끌고 오므로 빈 랜딩에서는 첫 로드 JS에서 뺀다. SSR은 켜
 * 둔다 — 저장된 대화(`/c/<id>`)는 서버 HTML에 본문이 그대로 실리고 하이드레이션이 그 청크를
 * 기다리는 동안 화면이 바뀌지 않는다.
 */
// `import()`를 이 자리에 그대로 둔다 — Next가 정적으로 읽어 SSR 때 청크 preload를 심는다.
const MessageList = dynamic(
    () => import('../MessageList').then(mod => mod.MessageList),
    { loading: () => <div className={MESSAGE_LIST_SLOT} /> }
);

/** 모바일 서랍(vaul). 데스크톱은 레일(`aside`)을 쓰므로 `lg` 미만에서만 불러온다. */
const SidebarDrawer = dynamic(
    () => import('../SidebarDrawer').then(mod => mod.SidebarDrawer),
    { ssr: false }
);

/** 위 `dynamic`과 같은 청크 — 번들러가 하나로 합친다. */
function loadMessageList(): void {
    void import('../MessageList');
}

interface ChatSessionProps {
    readonly conversationId: string | null;
    readonly initialMessages: ChatMessageView[];
    readonly conversationItems: ConversationListItem[];
    readonly onConversationCreated: (id: string, title: string) => void;
    readonly onConversationRenamed: (id: string, title: string) => void;
    readonly onConversationDeleted: (id: string) => void;
    /**
     * 새 대화로 세션을 다시 시작한다. 랜딩(`/`)에서 만든 대화에서 새 대화로 가면 같은 라우트라
     * Next가 다시 마운트하지 않으므로, 부모가 key를 바꿔 이 화면을 새로 만든다.
     */
    readonly onRestart: () => void;
    readonly signedIn: boolean;
    readonly localePrefix: string;
    readonly siteUrl: string;
    readonly currentPath: string;
    readonly suggestions?: PendingSuggestions | null;
    readonly initialDraft?: string;
}

/**
 * - **골격**: 레일에서 다른 대화로 가는 동안 떠나온 대화 대신 골격을 그린다. 지금 화면의 대화는
 *   라우트 prop이 아니라 스트림의 대화 id로 판정한다 — 랜딩에서 만든 대화는 prop이 계속 null이라
 *   그 대화를 다시 눌러도 골격이 번쩍였다.
 * - **새 대화**: 이 셸에서 만든 대화를 연 채 랜딩 트리에 있으면 `onRestart`로 세션을 새로 만든다.
 * - **로그인 경로**: 돌아올 곳은 지금 화면(`livePath`)이다 — 서버가 준 경로는 첫 전송의
 *   `replaceState` 뒤에도 `/`라, 세션 만료 후 로그인하면 빈 새 대화로 돌아갔다.
 */
export function ChatSession({
    conversationId,
    initialMessages,
    conversationItems,
    onConversationCreated,
    onConversationRenamed,
    onConversationDeleted,
    onRestart,
    signedIn,
    localePrefix,
    siteUrl,
    currentPath,
    suggestions,
    initialDraft,
}: ChatSessionProps) {
    const t = useTranslations('widgets.agent-chat');
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [switchingConversation, setSwitchingConversation] = useState(false);
    const drawerRef = useRef<HTMLDivElement>(null);
    const drawerTriggerRef = useRef<HTMLButtonElement>(null);
    // 서랍은 비모달이다(모달 vaul은 모바일 입력에서 포커스를 빼앗았다). 비모달 vaul은 바깥 누름을
    // 무시하므로 여기서 닫는다. 트리거는 제외한다 — 자기 클릭이 서랍을 연다.
    useOnClickOutside(
        [drawerRef, drawerTriggerRef],
        () => setDrawerOpen(false),
        { enabled: drawerOpen }
    );
    // 사이트 헤더(AuthSessionHeaderClient)와 같은 훅 — 폰에서 헤더와 이 바가 함께 숨고 돌아온다.
    const chromeHidden = useHideOnScrollDown();
    const isBelowLg = useMediaQuery(BELOW_LG_MEDIA_QUERY);
    // 서랍이 열린 채 `lg` 이상으로 넓어지면 서랍은 언마운트되지만 `drawerOpen`이 남아 버튼의
    // `aria-expanded`가 틀리고, 다시 좁히면 저절로 열린다. 렌더 중에 바로 닫는다.
    if (!isBelowLg && drawerOpen) setDrawerOpen(false);

    const stream = useAgentStream({
        conversationId,
        initialMessages,
        guest: !signedIn,
        onConversationCreated: (id, title) => {
            window.history.replaceState(null, '', `${localePrefix}/c/${id}`);
            onConversationCreated(id, title);
        },
    });
    const hasMessages = stream.messages.length > 0;
    const login = loginHref(
        siteUrl,
        localePrefix,
        livePath(localePrefix, currentPath, stream.conversationId)
    );
    const errorCopy = useAgentErrorCopy(stream.error, signedIn);

    useStripSsoParam();
    // 빈 랜딩: 첫 전송 때 본문 청크를 기다리며 빈 자리가 보이지 않도록 미리 받아 둔다.
    useIdlePreload(loadMessageList, !hasMessages);

    // 방문 중 만료된 세션은 스트림 라우트의 401로 드러난다 — 입력창이 막힌 채 죽은 배너로 두지
    // 않고 로그인 CTA와 같은 핸드오프로 보낸다.
    useEffect(() => {
        if (stream.error === 'unauthenticated') window.location.href = login;
    }, [stream.error, login]);

    const handleNavigationStart = (href: string): void => {
        const target = conversationIdOf(href);
        if (
            target === null &&
            conversationId === null &&
            stream.conversationId !== null
        ) {
            onRestart();
            return;
        }
        // 지금 열린 대화를 다시 누른 것이면 골격을 그리지 않는다 — 보던 대화를 지웠다가 같은
        // 대화로 되돌리는 깜빡임이 된다.
        setSwitchingConversation(
            isOtherConversation(target, stream.conversationId)
        );
    };

    const sidebar = (
        <Sidebar
            items={conversationItems}
            onRenamed={onConversationRenamed}
            onDeleted={onConversationDeleted}
            activeId={stream.conversationId}
            localePrefix={localePrefix}
            signedIn={signedIn}
            loginHref={login}
            siteUrl={siteUrl}
            onNavigationStart={handleNavigationStart}
            onNavigate={() => {
                setDrawerOpen(false);
                setSwitchingConversation(false);
            }}
        />
    );
    const activeTitle =
        conversationItems.find(c => c.id === stream.conversationId)?.title ??
        '';

    // 본문: 대화 전환 중엔 골격, 메시지가 없으면 빈 화면, 그 밖엔 대화 기록.
    const renderBody = (): ReactNode => {
        if (switchingConversation) return <ConversationSkeleton />;
        if (!hasMessages)
            return (
                <EmptyState
                    localePrefix={localePrefix}
                    signedIn={signedIn}
                    loginHref={login}
                    onPick={text => void stream.send(text)}
                    suggestions={suggestions}
                />
            );
        return (
            <MessageList
                // 실제 대화 전환에서만 다시 마운트해 "맨 아래로 즉시" 마운트 effect가 그때만
                // 돌게 한다(spec §3.9). 라우트 prop으로 키를 잡는다 — 새 대화의 첫 전송은 턴
                // 도중(SSE `meta`)에 스트림 id를 정하므로, 그걸로 키를 잡으면 첫 답이 흐르기
                // 시작할 때 다시 마운트돼 첫 턴의 전송 고정 스크롤이 깨진다.
                key={conversationId}
                messages={stream.messages}
                streaming={stream.status === 'streaming'}
                onRegenerate={() => void stream.regenerate()}
                onEdit={(seq, text) => void stream.edit(seq, text)}
                onSend={text => void stream.send(text)}
                siteUrl={siteUrl}
                localePrefix={localePrefix}
            />
        );
    };
    return (
        <div className="flex min-h-[calc(100dvh-var(--header-h))]">
            {/* 사이트 헤더 아래 뷰포트 높이로 고정 — 긴 목록이 페이지를 늘이지 않고 레일 안에서 스크롤한다. */}
            <aside className="surface-rail sticky top-(--header-h) hidden h-[calc(100dvh-var(--header-h))] w-64 shrink-0 self-start bg-secondary-950 lg:block">
                {sidebar}
            </aside>
            {isBelowLg ? (
                <SidebarDrawer
                    open={drawerOpen}
                    onOpenChange={setDrawerOpen}
                    contentRef={drawerRef}
                    title={t('ChatShell.9a7569')}
                    homeHref={`${siteUrl}${localePrefix}/`}
                    homeLabel={t('Sidebar.backToSiglens')}
                    closeLabel={t('ChatShell.closeConversations')}
                >
                    {sidebar}
                </SidebarDrawer>
            ) : null}
            <div className="flex min-w-0 flex-1 flex-col">
                <MobileChatBar
                    title={activeTitle}
                    drawerOpen={drawerOpen}
                    hidden={chromeHidden}
                    triggerRef={drawerTriggerRef}
                    onOpenDrawer={() => setDrawerOpen(true)}
                />
                {renderBody()}
                {errorCopy.message !== null &&
                stream.error !== 'unauthenticated' ? (
                    <StreamErrorBanner
                        message={errorCopy.message}
                        offerLogin={errorCopy.offerLogin}
                        retryable={errorCopy.retryable}
                        loginHref={login}
                        onRetry={() => void stream.retry()}
                    />
                ) : null}
                {!signedIn && hasMessages ? (
                    <GuestNotice loginHref={login} />
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
