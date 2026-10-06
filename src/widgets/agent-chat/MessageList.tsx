'use client';

import { splitAgentFollowUps } from '@y0ngha/siglens-core';
import { useTranslations } from 'next-intl';
import {
    useEffect,
    useId,
    useLayoutEffect,
    useRef,
    useState,
    type UIEvent,
} from 'react';
import {
    relatedSymbolPages,
    type RelatedSymbolPage,
} from '@/features/agent-chat/lib/relatedSymbolPages';
import type { AgentUiMessage } from '@/features/agent-chat/model/types';
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { BUTTON_GHOST, BUTTON_PRIMARY } from '@/shared/lib/buttonStyles';
import { useCopyToClipboard } from '@/shared/hooks/useCopyToClipboard';
import { useSymbolLabels } from './hooks/useSymbolLabels';
import { AgentMarkdown } from './AgentMarkdown';
import { ArrowDownIcon, ArrowUpRightIcon } from '@/shared/ui/StrokeIcons';
import { SiglensMark } from './SiglensMark';
import { ToolActivity } from './ToolActivity';

/**
 * "Near the bottom" cutoff (px) for the scroll-to-bottom button (spec §3.9).
 * Auto-follow while streaming is NOT the default (the reader keeps their place;
 * the question anchors to the viewport top on send) — it exists only as the
 * opt-in a click on that button starts, see `followingRef` in `MessageList`.
 */
const SCROLL_BOTTOM_THRESHOLD_PX = 80;

/**
 * How far `scrollTop` must fall below the highest point the follow reached
 * (px) before it counts as the user scrolling up and ends the opt-in follow.
 * It is also the "still at the bottom" band: a drop that lands within it is a
 * layout clamp or an iOS rubber-band return, not the user leaving. Our own
 * pinning only ever moves `scrollTop` down the page, never up.
 */
const USER_SCROLL_UP_TOLERANCE_PX = 4;

/**
 * Sub-pixel slack (px) for the check in the content-growth observer. There the
 * bar is lower than `USER_SCROLL_UP_TOLERANCE_PX`: a slow upward scroll moves a
 * few px per frame, and every growth tick would otherwise pin the view back
 * before the cumulative drop could ever reach the scroll handler's tolerance.
 */
const PIN_DRIFT_TOLERANCE_PX = 1;

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
    /** Sends a follow-up chip's text as the next user turn (same path as the composer). */
    readonly onSend: (text: string) => void;
    /** Main-site origin + locale prefix, for the "open on siglens" links under an answer. */
    readonly siteUrl: string;
    readonly localePrefix: string;
}

/** Small inline text action under a message. 32px tall so a row of them stays quiet but still hits the finger-target minimum with its padding. */
const ACTION =
    'inline-flex min-h-8 items-center gap-1 rounded px-1.5 text-xs text-secondary-400 hover:bg-secondary-800 hover:text-secondary-200 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none';

const COPIED_RESET_MS = 1_500;

const EDIT_ACTION_SIZE = 'min-h-9 px-3 text-sm';

/**
 * Quiet suggestion chip for a follow-up question. Same surface as the empty
 * state's `SuggestionCards` card, but shorter (`min-h-11` — the finger-target
 * floor) because it sits under an answer rather than being the screen's focus.
 */
const FOLLOW_UP_CHIP = cn(
    SURFACE_CARD,
    'group inline-flex min-h-11 max-w-full items-center justify-between gap-3 px-3.5 py-2 text-left text-sm leading-5 text-secondary-200 transition-colors hover:border-primary-400 hover:text-secondary-100 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none motion-reduce:transition-none'
);

interface FollowUpsProps {
    readonly items: readonly string[];
    readonly onPick: (text: string) => void;
}

/**
 * Follow-up questions the agent offered on its last line, as tappable chips.
 * Rendered only under the last finished answer: a chip under an old answer
 * would send a question about a conversation that has moved on.
 */
function FollowUps({ items, onPick }: FollowUpsProps) {
    const t = useTranslations('widgets.agent-chat');
    // Per-instance id: every assistant turn could render this component.
    const labelId = useId();
    if (items.length === 0) return null;
    return (
        <div className="mt-4">
            <p id={labelId} className="mb-2 text-xs text-secondary-400">
                {t('MessageList.followUpsLabel')}
            </p>
            <ul aria-labelledby={labelId} className="flex flex-wrap gap-2">
                {items.map((item, i) => (
                    // Index in the key: the model may repeat an item, and a
                    // collision would silently drop a chip.
                    <li key={`${i}-${item}`} className="max-w-full">
                        <button
                            type="button"
                            onClick={() => onPick(item)}
                            className={FOLLOW_UP_CHIP}
                        >
                            <span className="min-w-0 break-words">{item}</span>
                            <ArrowUpRightIcon className="size-4 shrink-0 text-secondary-400 transition-colors group-hover:text-primary-400 motion-reduce:transition-none" />
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
}

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
    onSend,
    siteUrl,
    localePrefix,
}: Props) {
    const t = useTranslations('widgets.agent-chat');
    const [editing, setEditing] = useState<{
        seq: number;
        text: string;
    } | null>(null);
    const { copied, copy } = useCopyToClipboard(COPIED_RESET_MS);
    // 훅은 "방금 복사됐는가"만 안다 — 어느 메시지였는지는 여기서 기억한다.
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
    /**
     * Opt-in follow (spec §3.9): set when the user clicks the scroll-to-bottom
     * button WHILE an answer is streaming, so the view stays pinned to the
     * bottom as the content grows. Cleared on an upward user scroll or when the
     * stream ends. A ref, not state — it only steers an imperative scroll in
     * the ResizeObserver callback and never changes what renders. The default
     * (no click) is no follow at all.
     */
    const followingRef = useRef(false);
    /**
     * Highest `scrollTop` reached while following — raised by our own pins and
     * by downward scrolls (the smooth scroll to the bottom). Measuring the user's
     * upward scroll against this peak, not against the previous scroll event,
     * is what lets a slow 1-3px/frame scroll-up (trackpad, momentum) add up to
     * "left the bottom" instead of slipping under the tolerance every frame.
     */
    const followPeakTopRef = useRef(0);

    const lastAssistant = messages.findLast(m => m.role === 'assistant');
    const lastUser = messages.findLast(m => m.role === 'user');

    const copyMessage = (m: AgentUiMessage): void => {
        setCopiedId(m.id);
        // Copy what the reader saw — the follow-up marker line is UI, not
        // answer text. A user turn is the user's own words, never split.
        void copy(
            m.role === 'assistant'
                ? splitAgentFollowUps(m.content).body
                : m.content
        );
    };

    /**
     * The user (wheel/touch/keyboard) has scrolled up since the follow's peak:
     * `scrollTop` sits more than `tolerance` below it AND the view is off the
     * bottom band. The second condition keeps a layout clamp (content shrank)
     * and an iOS rubber-band return — both land at the bottom — from reading
     * as the user leaving.
     */
    const userScrolledUpFromPeak = (
        el: HTMLElement,
        tolerance: number
    ): boolean =>
        followPeakTopRef.current - el.scrollTop > tolerance &&
        el.scrollHeight - el.scrollTop - el.clientHeight >
            USER_SCROLL_UP_TOLERANCE_PX;

    const handleScroll = (e: UIEvent<HTMLDivElement>): void => {
        const el = e.currentTarget;
        if (followingRef.current) {
            const nearBottom =
                el.scrollHeight - el.scrollTop - el.clientHeight <=
                USER_SCROLL_UP_TOLERANCE_PX;
            // Within the bottom band the peak simply tracks `scrollTop` — up
            // for a downward scroll, and also DOWN after a layout clamp or an
            // iOS rubber-band return, so a later real scroll-up is measured
            // from where the bottom actually is.
            if (nearBottom || el.scrollTop > followPeakTopRef.current)
                followPeakTopRef.current = el.scrollTop;
            else if (userScrolledUpFromPeak(el, USER_SCROLL_UP_TOLERANCE_PX))
                followingRef.current = false;
        }
        setShowScrollButton(isAwayFromBottom(el));
    };

    const scrollToBottom = (): void => {
        const el = containerRef.current;
        if (!el) return;
        // Clicking mid-stream opts into following the growing answer.
        if (streaming) {
            followingRef.current = true;
            followPeakTopRef.current = el.scrollTop;
        }
        el.scrollTo({
            top: el.scrollHeight,
            behavior: prefersReducedMotion() ? 'auto' : 'smooth',
        });
        // The button unmounts once the view reaches the bottom, which would
        // drop keyboard focus to <body>. Park it on the log instead (not the
        // composer: focusing a textarea pops the on-screen keyboard on touch
        // devices) so arrow/PageUp keys keep scrolling the transcript.
        el.focus({ preventScroll: true });
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

    // The opt-in follow ends with the stream.
    useEffect(() => {
        if (!streaming) followingRef.current = false;
    }, [streaming]);

    // `showScrollButton` otherwise only updates from the `onScroll` handler
    // above — but a streaming answer grows `scrollHeight` with no scroll
    // event at all, so a user who scrolled up would never see the ↓ button
    // appear (spec §3.9). Observing the content wrapper's size catches that
    // growth directly; the callback (not the effect body) sets state, since
    // this is an external subscription, not a render-time computation.
    // The same callback is where the opt-in follow pins the view: after a
    // click on the button mid-stream, each growth jumps to the new bottom
    // (instant — a smooth animation per token would lag behind the text).
    useEffect(() => {
        const content = contentRef.current;
        const container = containerRef.current;
        if (!content || !container) return;
        const observer = new ResizeObserver(() => {
            // A scroll-up the scroll handler has not yet seen enough of must win
            // over the pin, or the user could never get out of the follow.
            if (
                followingRef.current &&
                userScrolledUpFromPeak(container, PIN_DRIFT_TOLERANCE_PX)
            )
                followingRef.current = false;
            if (followingRef.current) {
                container.scrollTop = container.scrollHeight;
                followPeakTopRef.current = container.scrollTop;
            }
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
        // A new turn anchors to the viewport top (spec §3.9); never keep
        // pinning the previous answer's follow across it.
        followingRef.current = false;
        if (containerRef.current)
            setActiveMinHeight({ px: containerRef.current.clientHeight });
        pendingAnchorIdRef.current = lastUser.id;
    }, [messages]);

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
                                    onClick={() => copyMessage(m)}
                                    className={ACTION}
                                >
                                    {copied && copiedId === m.id
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
                                                className={cn(
                                                    BUTTON_GHOST,
                                                    EDIT_ACTION_SIZE
                                                )}
                                            >
                                                {t('MessageList.19b2d1')}
                                            </button>
                                            <button
                                                type="submit"
                                                className={cn(
                                                    BUTTON_PRIMARY,
                                                    EDIT_ACTION_SIZE
                                                )}
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
                        // Split on every render, streaming included: the body is
                        // safe to show chunk by chunk (a half-typed marker line
                        // is hidden), but the items can still grow mid-stream.
                        const { body, followUps } = splitAgentFollowUps(
                            m.content
                        );
                        const showFollowUps =
                            m === lastAssistant &&
                            m.status === 'complete' &&
                            !streaming;
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
                                        {body ? (
                                            <AgentMarkdown>
                                                {body}
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
                                        {!isStreaming && body ? (
                                            <RelatedPages
                                                pages={relatedSymbolPages(
                                                    m.tools
                                                )}
                                                siteUrl={siteUrl}
                                                localePrefix={localePrefix}
                                            />
                                        ) : null}
                                        {showFollowUps ? (
                                            <FollowUps
                                                items={followUps}
                                                onPick={onSend}
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
                    // button (`size-11`, see Composer.tsx's `ACTION_SIZE`).
                    className="absolute bottom-4 left-1/2 z-10 flex size-11 -translate-x-1/2 items-center justify-center rounded-full border border-border-control bg-secondary-800 text-secondary-200 shadow-lg hover:bg-secondary-700 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                >
                    <ArrowDownIcon className="size-5" />
                </button>
            ) : null}
        </div>
    );
}
