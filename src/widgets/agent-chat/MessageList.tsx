'use client';

import { useTranslations } from 'next-intl';
import {
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
    type UIEvent,
} from 'react';
import {
    relatedSymbolPages,
    type AgentUiMessage,
    type RelatedSymbolPage,
} from '@/features/agent-chat';
import { cn } from '@/shared/lib/cn';
import { useSymbolLabels } from './hooks/useSymbolLabels';
import { AgentMarkdown } from './AgentMarkdown';
import { ArrowDownIcon, ArrowUpRightIcon } from './icons';
import { SiglensMark } from './SiglensMark';
import { ToolActivity } from './ToolActivity';

/** "Near the bottom" cutoff (px) for both the scroll-to-bottom button (spec §3.9) and the removed auto-follow it replaces. */
const SCROLL_BOTTOM_THRESHOLD_PX = 80;

/** Shared by the scroll handler and the content-growth observer below — one formula, not two copies that can drift. */
function isAwayFromBottom(el: HTMLElement): boolean {
    return (
        el.scrollHeight - el.scrollTop - el.clientHeight >
        SCROLL_BOTTOM_THRESHOLD_PX
    );
}

/** `true` unless the browser reports a reduced-motion preference; `matchMedia` is absent in some test/SSR environments. */
function prefersReducedMotion(): boolean {
    return (
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    );
}

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
    const labels = useSymbolLabels(pages.map(page => page.symbol));
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
                    {t('MessageList.openOnSiglens', {
                        symbol: labels[page.symbol] ?? page.symbol,
                    })}
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
    const [editing, setEditing] = useState<{
        seq: number;
        text: string;
    } | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [showScrollButton, setShowScrollButton] = useState(false);
    /**
     * Min-height (px) held on the active (last) turn, so anchoring the
     * just-sent question to the viewport top has room to hold. Deliberately
     * NOT cleared when streaming ends — doing so collapses the page and
     * jumps the view on a short answer. It only changes at the next anchor
     * (a new user message) or resets via a conversation switch (this
     * component remounts, see the mount effect below).
     *
     * Wrapped in `{ px }` rather than a bare `number` —
     * `containerRef.current.clientHeight` is the SCROLLABLE VIEWPORT's
     * height, which is normally constant across an entire session (it
     * doesn't track content, only the window), so two consecutive anchors
     * can easily set the exact same number. A bare `useState<number>` would
     * bail out of re-rendering/re-committing on that repeat value, and the
     * `useLayoutEffect` below (keyed on this state, see next comment) would
     * then silently never fire for the second anchor. A fresh object every
     * call guarantees a fresh commit every time, regardless of whether the
     * height itself changed.
     */
    const [activeMinHeight, setActiveMinHeight] = useState<{
        px: number;
    } | null>(null);
    /**
     * The user message id waiting to be scrolled to the viewport top, set
     * by the detection effect below and consumed by the `useLayoutEffect`
     * above it. A REF, not state (react-hooks-js/set-state-in-effect)
     * — this value never affects what gets RENDERED
     * (only which DOM node an effect scrolls to afterward), so setting it
     * via `useState` only bought an extra unnecessary render pass on every
     * anchor.
     *
     * Splitting detection and scroll into two effects (rather than scrolling
     * inline in the detection effect) still matters: `setActiveMinHeight` is
     * a state update, so the DOM doesn't actually carry the new min-height
     * until the NEXT commit. Scrolling in the same effect that calls
     * `setActiveMinHeight` targets the OLD (too-short) layout — late in a
     * long conversation, where the container is already near its natural
     * height, that undershoots and the question never reaches the top. The
     * `useLayoutEffect` below is keyed on `activeMinHeight` (the state whose
     * committed DOM effect it needs to wait for) so it runs after React has
     * committed — and the browser has recalculated layout for — that new
     * min-height, meaning the scroll target is measured against the
     * CORRECT, already-tall layout.
     */
    const pendingAnchorIdRef = useRef<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const endRef = useRef<HTMLDivElement>(null);
    const userNodeRefs = useRef(new Map<string, HTMLElement>());
    const seenLastUserIdRef = useRef<string | null>(null);
    const isFirstRenderRef = useRef(true);
    const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const lastAssistant = messages.findLast(m => m.role === 'assistant');
    const lastUser = messages.findLast(m => m.role === 'user');

    const copy = (m: AgentUiMessage): void => {
        void navigator.clipboard?.writeText(m.content);
        setCopiedId(m.id);
        if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
        copiedTimerRef.current = setTimeout(
            () => setCopiedId(null),
            COPIED_RESET_MS
        );
    };

    const handleScroll = (e: UIEvent<HTMLDivElement>): void => {
        setShowScrollButton(isAwayFromBottom(e.currentTarget));
    };

    const scrollToBottom = (): void => {
        const el = containerRef.current;
        if (!el) return;
        el.scrollTo({
            top: el.scrollHeight,
            behavior: prefersReducedMotion() ? 'auto' : 'smooth',
        });
    };

    // Anchor-on-send, scroll half: the effect below writes the target id to
    // a ref (not state — it never affects what renders) and makes exactly
    // ONE state update, `setActiveMinHeight`. Keying this layout effect on
    // that same `activeMinHeight` state means it fires on the very next
    // commit after that state update lands, so the target node's layout
    // already reflects the grown min-height by the time `scrollIntoView`
    // runs.
    useLayoutEffect(() => {
        if (!pendingAnchorIdRef.current) return;
        userNodeRefs.current
            .get(pendingAnchorIdRef.current)
            ?.scrollIntoView({ block: 'start' });
        pendingAnchorIdRef.current = null;
    }, [activeMinHeight]);

    // Conversation open/switch jumps to the bottom instantly (spec §3.9) —
    // the CALLER remounts this component via `key={conversationId}`
    // (`ChatShell.tsx`), so a mount-only effect is exactly "on switch".
    // `block: 'end'` with the default `behavior: 'auto'` is an instant jump,
    // not a smooth scroll.
    useEffect(() => {
        endRef.current?.scrollIntoView({ block: 'end' });
    }, []);

    // `showScrollButton` otherwise only updates from the `onScroll` handler
    // above — but a streaming answer grows `scrollHeight` with no scroll
    // event at all, so a user who scrolled up would never see the ↓ button
    // appear (spec §3.9). Observing the content wrapper's size catches that
    // growth directly; the callback (not the effect body) sets state, since
    // this is an external subscription, not a render-time computation.
    useEffect(() => {
        const content = contentRef.current;
        const container = containerRef.current;
        if (!content || !container) return;
        const observer = new ResizeObserver(() => {
            setShowScrollButton(isAwayFromBottom(container));
        });
        observer.observe(content);
        return () => observer.disconnect();
    }, []);

    // Anchor-on-send, detection half (spec §3.9, ChatGPT/Gemini pattern):
    // when a NEW user message appears, grow the active turn's min-height and
    // record it as the pending scroll target — the actual scroll happens in
    // the `useLayoutEffect` above, once that min-height is on screen. The
    // conversation's initial load also introduces a "new" last user message
    // on first render, but that case is the mount-effect's job (jump to
    // bottom) — skipped here via `isFirstRenderRef`.
    useEffect(() => {
        const lastUser = messages.findLast(m => m.role === 'user');
        if (isFirstRenderRef.current) {
            isFirstRenderRef.current = false;
            seenLastUserIdRef.current = lastUser?.id ?? null;
            return;
        }
        if (!lastUser || lastUser.id === seenLastUserIdRef.current) return;
        seenLastUserIdRef.current = lastUser.id;
        if (containerRef.current)
            setActiveMinHeight({ px: containerRef.current.clientHeight });
        pendingAnchorIdRef.current = lastUser.id;
    }, [messages]);

    useEffect(
        () => () => {
            if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
        },
        []
    );

    return (
        <div className="relative min-h-0 flex-1">
            <div
                ref={containerRef}
                role="log"
                className="absolute inset-0 overflow-y-auto"
                onScroll={handleScroll}
            >
                <div
                    ref={contentRef}
                    className="mx-auto flex w-full max-w-3xl flex-col gap-7 px-4 py-8"
                >
                    {messages.map((m, i) => {
                        const isUser = m.role === 'user';
                        const isEditing =
                            editing !== null && editing.seq === m.seq;
                        const isLast = i === messages.length - 1;
                        const activeTurnStyle =
                            isLast && activeMinHeight !== null
                                ? { minHeight: activeMinHeight.px }
                                : undefined;
                        const registerUserNode = (
                            el: HTMLElement | null
                        ): void => {
                            if (el) userNodeRefs.current.set(m.id, el);
                            else userNodeRefs.current.delete(m.id);
                        };
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
                                {!isUser &&
                                m === lastAssistant &&
                                !streaming ? (
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
                                    ref={registerUserNode}
                                    data-role={m.role}
                                    style={activeTurnStyle}
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
                                    ref={registerUserNode}
                                    data-role="user"
                                    style={activeTurnStyle}
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
                                style={activeTurnStyle}
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
                                        ) : isStreaming && m.draft ? (
                                            <div>
                                                <p className="mb-2 text-xs text-secondary-400">
                                                    {t(
                                                        'MessageList.redrafting'
                                                    )}
                                                </p>
                                                <div className="text-secondary-400">
                                                    <AgentMarkdown>
                                                        {m.draft}
                                                    </AgentMarkdown>
                                                </div>
                                            </div>
                                        ) : isStreaming ? (
                                            <Thinking
                                                label={t(
                                                    'MessageList.generating'
                                                )}
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
                                                pages={relatedSymbolPages(
                                                    m.tools
                                                )}
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
            {showScrollButton ? (
                <button
                    type="button"
                    onClick={scrollToBottom}
                    aria-label={t('MessageList.scrollToBottom')}
                    // 44px-ish touch target, matching the Composer's send/stop
                    // button (`size-11`, see Composer.tsx's `ACTION_BUTTON`).
                    className="absolute bottom-4 left-1/2 flex size-11 -translate-x-1/2 items-center justify-center rounded-full border border-border-control bg-secondary-800 text-secondary-200 shadow-lg hover:bg-secondary-700 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                >
                    <ArrowDownIcon className="size-5" />
                </button>
            ) : null}
        </div>
    );
}
