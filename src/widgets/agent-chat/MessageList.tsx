'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import type { AgentUiMessage } from '@/features/agent-chat';
import { cn } from '@/shared/lib/cn';
import { AgentMarkdown } from './AgentMarkdown';
import { ToolActivity } from './ToolActivity';

interface Props {
    readonly messages: AgentUiMessage[];
    readonly streaming: boolean;
    readonly onRegenerate: () => void;
    readonly onEdit: (seq: number, text: string) => void;
}

export function MessageList({
    messages,
    streaming,
    onRegenerate,
    onEdit,
}: Props) {
    const t = useTranslations('widgets.agent-chat');
    const endRef = useRef<HTMLDivElement>(null);
    const [pinned, setPinned] = useState(true);
    const [editing, setEditing] = useState<{
        seq: number;
        text: string;
    } | null>(null);
    useEffect(() => {
        if (pinned) endRef.current?.scrollIntoView({ block: 'end' });
    }, [messages, pinned]);
    const lastAssistant = [...messages]
        .reverse()
        .find(m => m.role === 'assistant');
    const lastUser = [...messages].reverse().find(m => m.role === 'user');
    return (
        <div
            role="log"
            className="flex-1 overflow-y-auto px-4 py-6"
            onScroll={e => {
                const el = e.currentTarget;
                setPinned(
                    el.scrollHeight - el.scrollTop - el.clientHeight < 80
                );
            }}
        >
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
                {messages.map(m => (
                    <article
                        key={m.id}
                        className={cn(
                            'flex flex-col',
                            m.role === 'user' ? 'items-end' : 'items-start'
                        )}
                    >
                        <div
                            // Scoped to the one bubble that's actually changing, not the
                            // whole log — `aria-live` + `aria-relevant="additions text"`
                            // on the outer log re-announces the ENTIRE transcript on every
                            // streamed delta (every character), which drowns a screen
                            // reader user in noise on a multi-turn conversation.
                            aria-live={
                                m.role === 'assistant' &&
                                m.status === 'streaming'
                                    ? 'polite'
                                    : undefined
                            }
                            className={cn(
                                'max-w-[85%] rounded-lg px-4 py-3 text-sm leading-relaxed break-words',
                                m.role === 'user'
                                    ? 'bg-primary-600 text-white'
                                    : 'bg-secondary-800 text-secondary-100'
                            )}
                        >
                            {m.role === 'assistant' ? (
                                <ToolActivity tools={m.tools} />
                            ) : null}
                            {editing && editing.seq === m.seq ? (
                                <form
                                    onSubmit={e => {
                                        e.preventDefault();
                                        onEdit(editing.seq, editing.text);
                                        setEditing(null);
                                    }}
                                    className="flex flex-col gap-2"
                                >
                                    <textarea
                                        value={editing.text}
                                        onChange={e =>
                                            setEditing({
                                                ...editing,
                                                text: e.target.value,
                                            })
                                        }
                                        aria-label={t('MessageList.e6b008')}
                                        className="border-control min-h-20 w-72 rounded border bg-secondary-900 p-2 text-secondary-100"
                                    />
                                    <div className="flex gap-2">
                                        <button
                                            type="submit"
                                            className="rounded bg-primary-500 px-2 py-1 text-xs text-white focus-visible:ring-2 focus-visible:ring-primary-500"
                                        >
                                            {t('MessageList.6523ca')}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setEditing(null)}
                                            className="rounded px-2 py-1 text-xs focus-visible:ring-2 focus-visible:ring-primary-500"
                                        >
                                            {t('MessageList.19b2d1')}
                                        </button>
                                    </div>
                                </form>
                            ) : m.role === 'assistant' ? (
                                <AgentMarkdown>
                                    {m.content ||
                                        (m.status === 'streaming' ? '…' : '')}
                                </AgentMarkdown>
                            ) : (
                                <p className="whitespace-pre-wrap">
                                    {m.content}
                                </p>
                            )}
                            {m.status === 'aborted' ? (
                                <p className="mt-2 text-xs text-secondary-400">
                                    {t('MessageList.96adfe')}
                                </p>
                            ) : null}
                            {m.status === 'error' ? (
                                <p className="mt-2 text-xs text-ui-danger-text">
                                    {t('MessageList.afd172')}
                                </p>
                            ) : null}
                            {m.truncated ? (
                                <p className="mt-2 text-xs text-ui-warning-text">
                                    {t('MessageList.259976')}
                                </p>
                            ) : null}
                        </div>
                        <div className="mt-1 flex gap-2 text-xs text-secondary-400">
                            <button
                                type="button"
                                onClick={() =>
                                    void navigator.clipboard?.writeText(
                                        m.content
                                    )
                                }
                                className="rounded px-1 focus-visible:ring-2 focus-visible:ring-primary-500"
                            >
                                {t('MessageList.a55b1e')}
                            </button>
                            {m.role === 'assistant' &&
                            m === lastAssistant &&
                            !streaming ? (
                                <button
                                    type="button"
                                    onClick={onRegenerate}
                                    className="rounded px-1 focus-visible:ring-2 focus-visible:ring-primary-500"
                                >
                                    {t('MessageList.43da5e')}
                                </button>
                            ) : null}
                            {m.role === 'user' &&
                            m === lastUser &&
                            m.seq !== undefined &&
                            !streaming ? (
                                <button
                                    type="button"
                                    onClick={() =>
                                        setEditing({
                                            seq: m.seq!,
                                            text: m.content,
                                        })
                                    }
                                    className="rounded px-1 focus-visible:ring-2 focus-visible:ring-primary-500"
                                >
                                    {t('MessageList.e1407b')}
                                </button>
                            ) : null}
                        </div>
                    </article>
                ))}
                <div ref={endRef} />
            </div>
        </div>
    );
}
