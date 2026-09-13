'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import {
    relatedSymbolPages,
    type AgentUiMessage,
    type RelatedSymbolPage,
} from '@/features/agent-chat';
import { cn } from '@/shared/lib/cn';
import { AgentMarkdown } from './AgentMarkdown';
import { ArrowUpRightIcon } from './icons';
import { SiglensMark } from './SiglensMark';
import { ToolActivity } from './ToolActivity';

interface Props {
    readonly messages: AgentUiMessage[];
    readonly streaming: boolean;
    readonly onRegenerate: () => void;
    readonly onEdit: (seq: number, text: string) => void;
    /** Main-site origin + locale prefix, for the "open on siglens" links under an answer. */
    readonly siteUrl: string;
    readonly localePrefix: string;
}

/** Small inline text action under a message. 32px tall so a row of them stays quiet but still hits the finger-target minimum with its padding. */
const ACTION =
    'inline-flex min-h-8 items-center gap-1 rounded px-1.5 text-xs text-secondary-400 hover:bg-secondary-800 hover:text-secondary-200 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none';

const COPIED_RESET_MS = 1_500;

interface RelatedPagesProps {
    readonly pages: RelatedSymbolPage[];
    readonly siteUrl: string;
    readonly localePrefix: string;
}

/**
 * The way back to siglens.io from an answer: the symbol pages the agent read,
 * as quiet links under the text. A hook, not a banner — it only appears when
 * the answer was about a symbol, and only for symbols actually looked up.
 */
function RelatedPages({ pages, siteUrl, localePrefix }: RelatedPagesProps) {
    const t = useTranslations('widgets.agent-chat');
    if (pages.length === 0) return null;
    return (
        <nav
            aria-label={t('MessageList.relatedPages')}
            className="mt-4 flex flex-wrap items-center gap-1.5"
        >
            {pages.map(page => (
                <a
                    key={page.symbol}
                    href={`${siteUrl}${localePrefix}/${encodeURIComponent(page.symbol)}${page.tab ? `/${page.tab}` : ''}`}
                    className="inline-flex min-h-8 items-center gap-1 rounded-full border border-border-control px-2.5 text-xs text-secondary-300 hover:border-primary-400 hover:text-primary-400 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                >
                    {t('MessageList.openOnSiglens', { symbol: page.symbol })}
                    <ArrowUpRightIcon className="size-3" />
                </a>
            ))}
        </nav>
    );
}

/**
 * Three dots that breathe while the first token is still on its way. Not a
 * live region of its own — it only renders inside the streaming turn's
 * `aria-live` wrapper, and nested live regions announce unpredictably.
 */
function Thinking({ label }: { readonly label: string }) {
    return (
        <span className="inline-flex h-7 items-center gap-1">
            <span className="sr-only">{label}</span>
            {[0, 1, 2].map(i => (
                <span
                    key={i}
                    aria-hidden="true"
                    className="size-1.5 rounded-full bg-secondary-400 motion-safe:animate-pulse"
                    style={{ animationDelay: `${i * 160}ms` }}
                />
            ))}
        </span>
    );
}

/**
 * The transcript. Assistant turns read as plain text under a small mark —
 * no bubble, the way chat products lay out the answer column — and user
 * turns sit right-aligned in a quiet surface. Per-message actions stay in
 * the DOM at all times (keyboard and screen-reader reachable); on wide
 * screens they merely fade in on hover/focus so the column stays calm.
 */
export function MessageList({
    messages,
    streaming,
    onRegenerate,
    onEdit,
    siteUrl,
    localePrefix,
}: Props) {
    const t = useTranslations('widgets.agent-chat');
    const [pinned, setPinned] = useState(true);
    const [editing, setEditing] = useState<{
        seq: number;
        text: string;
    } | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const endRef = useRef<HTMLDivElement>(null);
    const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        if (pinned) endRef.current?.scrollIntoView({ block: 'end' });
    }, [messages, pinned]);
    useEffect(
        () => () => {
            if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
        },
        []
    );
    const lastAssistant = [...messages]
        .reverse()
        .find(m => m.role === 'assistant');
    const lastUser = [...messages].reverse().find(m => m.role === 'user');

    const copy = (m: AgentUiMessage): void => {
        void navigator.clipboard?.writeText(m.content);
        setCopiedId(m.id);
        if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
        copiedTimerRef.current = setTimeout(
            () => setCopiedId(null),
            COPIED_RESET_MS
        );
    };

    return (
        <div
            role="log"
            className="flex-1 overflow-y-auto"
            onScroll={e => {
                const el = e.currentTarget;
                setPinned(
                    el.scrollHeight - el.scrollTop - el.clientHeight < 80
                );
            }}
        >
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-7 px-4 py-8">
                {messages.map(m => {
                    const isUser = m.role === 'user';
                    const isEditing = editing !== null && editing.seq === m.seq;
                    const actions = (
                        <div
                            className={cn(
                                'mt-1 flex gap-0.5',
                                isUser ? 'justify-end' : 'ml-10',
                                // Always in the DOM; only the wide-screen presentation is hover/focus-gated.
                                'sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:focus-within:opacity-100 motion-reduce:transition-none'
                            )}
                        >
                            <button
                                type="button"
                                onClick={() => copy(m)}
                                className={ACTION}
                            >
                                {copiedId === m.id
                                    ? t('MessageList.copied')
                                    : t('MessageList.a55b1e')}
                            </button>
                            {!isUser && m === lastAssistant && !streaming ? (
                                <button
                                    type="button"
                                    onClick={onRegenerate}
                                    className={ACTION}
                                >
                                    {t('MessageList.43da5e')}
                                </button>
                            ) : null}
                            {isUser &&
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
                                    className={ACTION}
                                >
                                    {t('MessageList.e1407b')}
                                </button>
                            ) : null}
                        </div>
                    );

                    if (isEditing) {
                        return (
                            <article
                                key={m.id}
                                data-role={m.role}
                                className="flex flex-col items-end"
                            >
                                <form
                                    onSubmit={e => {
                                        e.preventDefault();
                                        onEdit(editing.seq, editing.text);
                                        setEditing(null);
                                    }}
                                    className="flex w-full max-w-[80%] flex-col gap-2 rounded-lg border border-border-control bg-secondary-800 p-2 focus-within:ring-2 focus-within:ring-primary-500"
                                >
                                    <textarea
                                        value={editing.text}
                                        onChange={e =>
                                            setEditing({
                                                ...editing,
                                                text: e.target.value,
                                            })
                                        }
                                        rows={3}
                                        aria-label={t('MessageList.e6b008')}
                                        className="min-h-20 w-full resize-y bg-transparent px-2 py-1.5 text-[15px] leading-6 text-secondary-100 focus-visible:outline-none"
                                    />
                                    <div className="flex justify-end gap-1.5">
                                        <button
                                            type="button"
                                            onClick={() => setEditing(null)}
                                            className="inline-flex min-h-9 items-center rounded-lg px-3 text-sm text-secondary-300 hover:bg-secondary-700 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                                        >
                                            {t('MessageList.19b2d1')}
                                        </button>
                                        <button
                                            type="submit"
                                            className="inline-flex min-h-9 items-center rounded-lg bg-primary-600 px-3 text-sm font-medium text-white hover:bg-primary-500 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                                        >
                                            {t('MessageList.6523ca')}
                                        </button>
                                    </div>
                                </form>
                            </article>
                        );
                    }

                    if (isUser) {
                        return (
                            <article
                                key={m.id}
                                data-role="user"
                                className="group flex flex-col items-end"
                            >
                                <div className="max-w-[80%] rounded-lg bg-secondary-800 px-4 py-2.5 text-[15px] leading-6 break-words whitespace-pre-wrap text-secondary-100">
                                    {m.content}
                                </div>
                                {actions}
                            </article>
                        );
                    }

                    const isStreaming = m.status === 'streaming';
                    return (
                        <article
                            key={m.id}
                            data-role="assistant"
                            className="group flex flex-col"
                        >
                            <div className="flex items-start gap-3">
                                <SiglensMark className="mt-0.5" />
                                <div
                                    // Scoped to the one turn that is actually changing — an
                                    // `aria-live` on the whole log re-announces the entire
                                    // transcript on every streamed delta.
                                    aria-live={
                                        isStreaming ? 'polite' : undefined
                                    }
                                    className="min-w-0 flex-1 text-[15px] leading-7 break-words text-secondary-100"
                                >
                                    <ToolActivity tools={m.tools} />
                                    {m.content ? (
                                        <AgentMarkdown>
                                            {m.content}
                                        </AgentMarkdown>
                                    ) : isStreaming ? (
                                        <Thinking
                                            label={t('MessageList.generating')}
                                        />
                                    ) : null}
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
                                    {!isStreaming && m.content ? (
                                        <RelatedPages
                                            pages={relatedSymbolPages(m.tools)}
                                            siteUrl={siteUrl}
                                            localePrefix={localePrefix}
                                        />
                                    ) : null}
                                </div>
                            </div>
                            {actions}
                        </article>
                    );
                })}
                <div ref={endRef} />
            </div>
        </div>
    );
}
