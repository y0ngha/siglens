'use client';

/**
 * 대화 기록 — 메시지 턴을 순서대로 그리고, 어느 턴에 어떤 동작(복사·다시 생성·편집·후속 질문)을
 * 붙일지 고른다. 스크롤 동작은 `useTranscriptScroll`, 턴 하나의 모양은 `message/*`가 맡는다.
 */
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import type { AgentUiMessage } from '@/features/agent-chat/model/types';
import { cn } from '@/shared/lib/cn';
import { useCopyToClipboard } from '@/shared/hooks/useCopyToClipboard';
import { ArrowDownIcon } from '@/shared/ui/StrokeIcons';
import { useRelatedPages } from './hooks/useRelatedPages';
import { useTranscriptScroll } from './hooks/useTranscriptScroll';
import { AssistantMessage } from './message/AssistantMessage';
import { EditMessageForm } from './message/EditMessageForm';
import { MessageActions } from './message/MessageActions';
import { UserMessage } from './message/UserMessage';
import { AI_RAISED_CONTROL } from './aiSurfaceStyles';

interface Props {
    readonly messages: AgentUiMessage[];
    readonly streaming: boolean;
    readonly onRegenerate: () => void;
    readonly onEdit: (seq: number, text: string) => void;
    /** Sends a follow-up chip's text as the next user turn (same path as the composer). */
    readonly onSend: (text: string) => void;
    /** Main-site origin + locale prefix, for the "open on siglens" links under an answer. */
    readonly siteUrl: string;
    readonly localePrefix: string;
}

const COPIED_RESET_MS = 1_500;

/**
 * 편집·다시 생성은 마지막 질문/답에만, 스트리밍이 아닐 때만 연다. 편집 중인 seq가 그 조건을
 * 벗어나면(스트리밍 시작, 다른 턴이 마지막이 됨) 폼을 닫는다.
 */
export function MessageList({
    messages,
    streaming,
    onRegenerate,
    onEdit,
    onSend,
    siteUrl,
    localePrefix,
}: Props) {
    const t = useTranslations('widgets.agent-chat');
    const [editingSeq, setEditingSeq] = useState<number | null>(null);
    const { copied, copy } = useCopyToClipboard(COPIED_RESET_MS);
    // 훅은 "방금 복사됐는가"만 안다 — 어느 메시지였는지는 여기서 기억한다.
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const {
        containerRef,
        contentRef,
        endRef,
        registerUserNode,
        activeMinHeight,
        showScrollButton,
        handleScroll,
        scrollToBottom,
    } = useTranscriptScroll(messages, streaming);
    // 끝난 답변의 링크·표시 이름 — 프레임마다 다시 계산하지 않는다(`useRelatedPages`).
    const { pagesById: relatedPagesById, labels: symbolLabels } =
        useRelatedPages(messages);

    const lastAssistant = messages.findLast(m => m.role === 'assistant');
    const lastUser = messages.findLast(m => m.role === 'user');
    // 편집 대상이 더는 편집 가능하지 않으면(스트리밍 시작, 다른 질문이 마지막이 됨) 렌더 중에 닫는다 —
    // 남겨 두면 스트리밍이 끝난 뒤 그 질문이 다시 마지막이 될 때 폼이 저절로 다시 열린다.
    if (editingSeq !== null && (streaming || lastUser?.seq !== editingSeq))
        setEditingSeq(null);

    // 독자가 본 그대로 복사한다 — 후속 질문 표시 줄은 서버가 이미 `followUps`로 떼어 냈다.
    const copyMessage = (m: AgentUiMessage): void => {
        setCopiedId(m.id);
        void copy(m.content);
    };

    const renderTurn = (m: AgentUiMessage, isLast: boolean) => {
        const minHeight =
            isLast && activeMinHeight !== null ? activeMinHeight : undefined;
        const isEditableUser =
            m.role === 'user' &&
            m === lastUser &&
            m.seq !== undefined &&
            !streaming;
        const actions = (
            <MessageActions
                align={m.role === 'user' ? 'user' : 'assistant'}
                copied={copied && copiedId === m.id}
                onCopy={() => copyMessage(m)}
                onRegenerate={
                    m.role === 'assistant' && m === lastAssistant && !streaming
                        ? onRegenerate
                        : undefined
                }
                onEdit={
                    isEditableUser ? () => setEditingSeq(m.seq!) : undefined
                }
            />
        );

        if (m.role === 'assistant') {
            return (
                <AssistantMessage
                    key={m.id}
                    message={m}
                    relatedPages={relatedPagesById.get(m.id) ?? []}
                    symbolLabels={symbolLabels}
                    showFollowUps={
                        m === lastAssistant &&
                        m.status === 'complete' &&
                        !streaming
                    }
                    onPickFollowUp={onSend}
                    siteUrl={siteUrl}
                    localePrefix={localePrefix}
                    minHeight={minHeight}
                    actions={actions}
                />
            );
        }

        if (isEditableUser && editingSeq === m.seq) {
            const seq = m.seq!;
            return (
                <article
                    key={m.id}
                    ref={registerUserNode(m.id)}
                    data-role="user"
                    style={minHeight === undefined ? undefined : { minHeight }}
                    className="flex flex-col items-end"
                >
                    <EditMessageForm
                        initialText={m.content}
                        onSave={text => {
                            onEdit(seq, text);
                            setEditingSeq(null);
                        }}
                        onCancel={() => setEditingSeq(null)}
                    />
                </article>
            );
        }

        return (
            <UserMessage
                key={m.id}
                content={m.content}
                nodeRef={registerUserNode(m.id)}
                minHeight={minHeight}
                actions={actions}
            />
        );
    };

    return (
        <div className="relative min-h-0 flex-1">
            <div
                ref={containerRef}
                role="log"
                // Programmatic focus target after the scroll-to-bottom click
                // (see `scrollToBottom`); not in the tab order, no ring —
                // `outline-hidden` (not `outline-none`) keeps the
                // forced-colors fallback outline.
                tabIndex={-1}
                aria-label={t('MessageList.logLabel')}
                className="absolute inset-0 overflow-y-auto focus:outline-hidden"
                onScroll={handleScroll}
            >
                <div
                    ref={contentRef}
                    className="mx-auto flex w-full max-w-3xl flex-col gap-7 px-4 py-8"
                >
                    {messages.map((m, i) =>
                        renderTurn(m, i === messages.length - 1)
                    )}
                    <div ref={endRef} />
                </div>
            </div>
            {showScrollButton ? (
                <button
                    type="button"
                    onClick={scrollToBottom}
                    aria-label={t('MessageList.scrollToBottom')}
                    // 44px-ish touch target, matching the Composer's send/stop
                    // button (`size-11`, see Composer.tsx's `ACTION_SIZE`).
                    className={cn(
                        AI_RAISED_CONTROL,
                        'absolute bottom-4 left-1/2 z-10 flex size-11 -translate-x-1/2 items-center justify-center rounded-full text-secondary-200 hover:text-secondary-100'
                    )}
                >
                    <ArrowDownIcon className="size-5" />
                </button>
            ) : null}
        </div>
    );
}
