'use client';

import {
    useEffect,
    useRef,
    useState,
    useTransition,
    type KeyboardEvent,
    type MouseEvent,
} from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import {
    deleteConversationAction,
    renameConversationAction,
    type ConversationListItem,
} from '@/entities/chat-conversation/actions';
import {
    groupConversationsByDay,
    type ConversationGroupKey,
} from '@/features/agent-chat';
import { cn } from '@/shared/lib/cn';
import { LABEL_KO } from '@/shared/lib/typographyStyles';
import { useOnClickOutside } from '@/shared/hooks/useOnClickOutside';
import {
    ArrowUpRightIcon,
    CloseIcon,
    PencilIcon,
    PlusIcon,
    TrashIcon,
} from './icons';

interface Props {
    readonly items: ConversationListItem[];
    readonly activeId: string | null;
    readonly localePrefix: string;
    readonly signedIn: boolean;
    readonly loginHref: string;
    /** Main-site origin, for the legal links and the way back to siglens.io. */
    readonly siteUrl: string;
    /** Applies a rename to the list the parent owns (also used to roll back a failed one). */
    readonly onRenamed: (id: string, title: string) => void;
    /** Drops a deleted conversation from the list the parent owns. */
    readonly onDeleted: (id: string) => void;
    /** Called when the rail starts an in-app navigation (the mobile drawer closes on it). */
    readonly onNavigate?: () => void;
}

interface RailFooterProps {
    readonly siteUrl: string;
    readonly localePrefix: string;
}

/**
 * Bottom of the rail: the ai host has no site footer, so the terms, the
 * privacy policy and the way back to siglens.io live here.
 */
function RailFooter({ siteUrl, localePrefix }: RailFooterProps) {
    const t = useTranslations('widgets.agent-chat');
    const link =
        'rounded px-1 py-1 hover:text-secondary-200 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none';
    return (
        <div className="border-t border-secondary-700 px-1 pt-3 text-xs text-secondary-400">
            <a
                href={`${siteUrl}${localePrefix}/`}
                className={cn(link, 'inline-flex items-center gap-1')}
            >
                {t('Sidebar.backToSiglens')}
                <ArrowUpRightIcon className="size-3" />
            </a>
            <p className="mt-1 flex flex-wrap gap-x-2">
                <a href={`${siteUrl}${localePrefix}/terms`} className={link}>
                    {t('Sidebar.terms')}
                </a>
                <a href={`${siteUrl}${localePrefix}/privacy`} className={link}>
                    {t('Sidebar.privacy')}
                </a>
            </p>
        </div>
    );
}

/** Icon-only row actions: reachable at all times, but on wide screens they fade in on hover/focus so the list reads as a list. */
const ROW_ACTION =
    'inline-flex size-7 shrink-0 items-center justify-center rounded text-secondary-400 hover:bg-secondary-700 hover:text-secondary-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100';

/**
 * Conversation rail. Grouped by day the way chat products do, with rename and
 * delete inline (delete needs a second click — no modal, no accidental loss).
 * The rail's own controls are quiet by design: the conversation column is the
 * product, this is its table of contents.
 */
export function Sidebar({
    items,
    activeId,
    localePrefix,
    signedIn,
    loginHref,
    siteUrl,
    onRenamed,
    onDeleted,
    onNavigate,
}: Props) {
    const t = useTranslations('widgets.agent-chat');
    const router = useRouter();
    const [isNavigating, startNavigation] = useTransition();
    const [pendingHref, setPendingHref] = useState<string | null>(null);
    const [filter, setFilter] = useState('');
    const [renaming, setRenaming] = useState<{
        id: string;
        title: string;
    } | null>(null);
    const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(
        null
    );
    const renameInputRef = useRef<HTMLInputElement>(null);
    const renameTriggerRef = useRef<HTMLButtonElement | null>(null);
    const renameRowRef = useRef<HTMLLIElement>(null);
    const renamingId = renaming?.id ?? null;
    const visible = items.filter(i =>
        i.title.toLowerCase().includes(filter.toLowerCase())
    );
    const groups = groupConversationsByDay(visible);
    const groupLabel: Record<ConversationGroupKey, string> = {
        today: t('Sidebar.groupToday'),
        yesterday: t('Sidebar.groupYesterday'),
        week: t('Sidebar.groupWeek'),
        older: t('Sidebar.groupOlder'),
    };

    // Focus the rename input exactly once when entering rename mode for a
    // given item — not on every render (an inline `ref={el => el.focus()}`
    // re-fires after each keystroke and steals the caret position).
    useEffect(() => {
        if (renaming) renameInputRef.current?.focus();
        // Refocusing an already-focused input is a no-op (doesn't move the
        // caret), so depending on the whole `renaming` object — not just its
        // `id` — is safe and keeps `react-hooks/exhaustive-deps` honest.
    }, [renaming]);

    // A press anywhere outside the row being renamed cancels the rename. Listens
    // for `pointerdown`, not the input's `blur`: blur also fires when focus moves
    // for reasons the user did not choose (a screen reader's virtual cursor), and
    // a real press outside is the only signal that means "I'm done here". The row
    // itself is excluded so the ✕ toggle and the input keep their own behaviour.
    // No focus return here — the press already put focus where the user wanted it.
    useOnClickOutside(renameRowRef, () => setRenaming(null), {
        enabled: renamingId !== null,
    });

    /**
     * In-app navigation between conversations (and to a new chat). A plain
     * `<a href>` reloaded the whole document, and the streamed response showed a
     * loading skeleton before the conversation — a flash on every switch
     * (2026-09-15 사용자 요청). `router.push` inside a transition keeps the
     * current screen until the next one is ready; the clicked row is muted meanwhile.
     */
    function startNavigationTo(href: string): void {
        onNavigate?.();
        setPendingHref(href);
        startNavigation(() => router.push(href));
    }

    // The `href` stays on the anchor so middle-click / ⌘-click still open a tab —
    // only a plain left click is intercepted into the transition above.
    function navigate(
        event: MouseEvent<HTMLAnchorElement>,
        href: string
    ): void {
        if (
            event.defaultPrevented ||
            event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey
        )
            return;
        event.preventDefault();
        startNavigationTo(href);
    }
    const isPending = (href: string): boolean =>
        isNavigating && pendingHref === href;

    function closeRename(): void {
        setRenaming(null);
        // Return focus to the ✎ button that opened rename mode instead of
        // letting it fall to <body> — the input is about to unmount.
        renameTriggerRef.current?.focus();
    }

    if (!signedIn) {
        // A guest has no history to list; say what signing in gets them
        // instead of rendering an empty search box over "no conversations".
        return (
            <nav
                aria-label={t('Sidebar.9a7569')}
                className="flex h-full flex-col gap-3 p-3"
            >
                <div className="rounded-lg border border-secondary-700 bg-secondary-800 p-4">
                    <p className="text-sm font-medium text-secondary-100">
                        {t('Sidebar.guestTitle')}
                    </p>
                    <p className="mt-1.5 text-xs leading-5 text-secondary-400">
                        {t('Sidebar.guestBody')}
                    </p>
                    <a
                        href={loginHref}
                        className="mt-3 inline-flex min-h-9 items-center rounded-lg bg-primary-600 px-3 text-xs font-medium text-white hover:bg-primary-700 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                    >
                        {t('Sidebar.guestCta')}
                    </a>
                </div>
                <div className="flex-1" />
                <RailFooter siteUrl={siteUrl} localePrefix={localePrefix} />
            </nav>
        );
    }

    return (
        <nav
            aria-label={t('Sidebar.9a7569')}
            className="flex h-full flex-col gap-2 p-3"
        >
            <a
                href={`${localePrefix}/`}
                onClick={e => navigate(e, `${localePrefix}/`)}
                aria-busy={isPending(`${localePrefix}/`) || undefined}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border-control bg-secondary-800 px-3 text-sm font-medium text-secondary-100 hover:border-primary-400 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none aria-busy:cursor-progress aria-busy:text-secondary-400"
            >
                <PlusIcon className="size-4 text-primary-400" />
                {t('Sidebar.newChat')}
            </a>
            <input
                type="search"
                value={filter}
                onChange={e => setFilter(e.target.value)}
                placeholder={t('Sidebar.4cbbe4')}
                aria-label={t('Sidebar.4cbbe4')}
                autoComplete="off"
                className="min-h-9 rounded-lg border border-border-control bg-transparent px-2.5 text-sm text-secondary-100 placeholder:text-secondary-400 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
            />
            <div className="min-h-0 flex-1 overflow-y-auto">
                {groups.length === 0 ? (
                    <p className="px-2 pt-6 text-center text-sm text-secondary-400">
                        {items.length === 0
                            ? t('Sidebar.empty')
                            : t('Sidebar.noMatch')}
                    </p>
                ) : null}
                {groups.map(group => (
                    <section
                        key={group.key}
                        aria-labelledby={`sidebar-group-${group.key}`}
                    >
                        <p
                            id={`sidebar-group-${group.key}`}
                            className={cn(LABEL_KO, 'px-2 pt-4 pb-1')}
                        >
                            {groupLabel[group.key]}
                        </p>
                        <ul className="space-y-0.5">
                            {group.items.map(item => (
                                <li
                                    key={item.id}
                                    ref={
                                        renamingId === item.id
                                            ? renameRowRef
                                            : undefined
                                    }
                                    className={cn(
                                        'group relative flex min-h-9 items-center gap-0.5 rounded-lg pr-1 pl-2.5 text-sm',
                                        item.id === activeId
                                            ? 'bg-secondary-800 text-secondary-100 before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-primary-400'
                                            : 'text-secondary-300 hover:bg-secondary-800 hover:text-secondary-100'
                                    )}
                                >
                                    {renaming?.id === item.id ? (
                                        <form
                                            className="flex-1"
                                            onSubmit={async e => {
                                                e.preventDefault();
                                                const title =
                                                    renaming.title.trim();
                                                closeRename();
                                                if (
                                                    title.length === 0 ||
                                                    title === item.title
                                                )
                                                    return;
                                                // Optimistic: the new title shows at once and
                                                // rolls back only if the server refuses it.
                                                onRenamed(item.id, title);
                                                const { ok } =
                                                    await renameConversationAction(
                                                        item.id,
                                                        title
                                                    );
                                                if (!ok)
                                                    onRenamed(
                                                        item.id,
                                                        item.title
                                                    );
                                            }}
                                        >
                                            <input
                                                ref={renameInputRef}
                                                value={renaming.title}
                                                onChange={e =>
                                                    setRenaming({
                                                        id: item.id,
                                                        title: e.target.value,
                                                    })
                                                }
                                                onKeyDown={(
                                                    e: KeyboardEvent<HTMLInputElement>
                                                ) => {
                                                    // Cancel only on an explicit Escape — cancelling on
                                                    // `onBlur` fires whenever focus moves for ANY reason
                                                    // (e.g. a screen reader's virtual cursor), discarding
                                                    // an in-progress rename the user never asked to abandon.
                                                    if (e.key === 'Escape') {
                                                        e.preventDefault();
                                                        closeRename();
                                                    }
                                                }}
                                                aria-label={t('Sidebar.586a5c')}
                                                className="w-full rounded border border-border-control bg-secondary-900 px-1.5 py-0.5 text-secondary-100 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                                            />
                                        </form>
                                    ) : (
                                        <a
                                            href={`${localePrefix}/c/${item.id}`}
                                            onClick={e =>
                                                navigate(
                                                    e,
                                                    `${localePrefix}/c/${item.id}`
                                                )
                                            }
                                            aria-current={
                                                item.id === activeId
                                                    ? 'page'
                                                    : undefined
                                            }
                                            aria-busy={
                                                isPending(
                                                    `${localePrefix}/c/${item.id}`
                                                ) || undefined
                                            }
                                            className="min-w-0 flex-1 truncate py-1.5 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none aria-busy:cursor-progress aria-busy:text-secondary-400"
                                        >
                                            {item.title}
                                        </a>
                                    )}
                                    {confirmingDeleteId === item.id ? (
                                        <span className="flex items-center gap-1 text-xs whitespace-nowrap text-ui-danger-text">
                                            {t('Sidebar.14bb5e')}
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    setConfirmingDeleteId(null);
                                                    const { ok } =
                                                        await deleteConversationAction(
                                                            item.id
                                                        );
                                                    if (!ok) return;
                                                    if (item.id === activeId) {
                                                        startNavigationTo(
                                                            `${localePrefix}/`
                                                        );
                                                    } else onDeleted(item.id);
                                                }}
                                                className="rounded px-1 font-medium underline focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                                            >
                                                {t('Sidebar.fc81e2')}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setConfirmingDeleteId(null)
                                                }
                                                className="rounded px-1 text-secondary-300 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                                            >
                                                {t('Sidebar.19b2d1')}
                                            </button>
                                        </span>
                                    ) : (
                                        <>
                                            {/* One button that toggles, not two that swap: the
                                                element stays mounted, so `closeRename` can hand
                                                focus back to it. */}
                                            <button
                                                type="button"
                                                aria-label={
                                                    renamingId === item.id
                                                        ? t(
                                                              'Sidebar.renameCancel'
                                                          )
                                                        : t('Sidebar.73e5a8')
                                                }
                                                onClick={e => {
                                                    if (
                                                        renamingId === item.id
                                                    ) {
                                                        closeRename();
                                                        return;
                                                    }
                                                    renameTriggerRef.current =
                                                        e.currentTarget;
                                                    setRenaming({
                                                        id: item.id,
                                                        title: item.title,
                                                    });
                                                }}
                                                // Stays visible while renaming: it is the only
                                                // on-screen way out besides Escape.
                                                className={cn(
                                                    ROW_ACTION,
                                                    renamingId === item.id &&
                                                        'sm:opacity-100'
                                                )}
                                            >
                                                {renamingId === item.id ? (
                                                    <CloseIcon className="size-3.5" />
                                                ) : (
                                                    <PencilIcon className="size-3.5" />
                                                )}
                                            </button>
                                            <button
                                                type="button"
                                                aria-label={t('Sidebar.fc81e2')}
                                                onClick={() =>
                                                    setConfirmingDeleteId(
                                                        item.id
                                                    )
                                                }
                                                className={ROW_ACTION}
                                            >
                                                <TrashIcon className="size-3.5" />
                                            </button>
                                        </>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </section>
                ))}
            </div>
            <RailFooter siteUrl={siteUrl} localePrefix={localePrefix} />
        </nav>
    );
}
