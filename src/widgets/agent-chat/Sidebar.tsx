'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
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

interface Props {
    readonly items: ConversationListItem[];
    readonly activeId: string | null;
    readonly localePrefix: string;
}

/** Icon-only row actions: reachable at all times, but on wide screens they fade in on hover/focus so the list reads as a list. */
const ROW_ACTION =
    'inline-flex size-7 shrink-0 items-center justify-center rounded text-xs text-secondary-400 hover:bg-secondary-700 hover:text-secondary-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100';

/**
 * Conversation rail. Grouped by day the way chat products do, with rename and
 * delete inline (delete needs a second click — no modal, no accidental loss).
 * The rail's own controls are quiet by design: the conversation column is the
 * product, this is its table of contents.
 */
export function Sidebar({ items, activeId, localePrefix }: Props) {
    const t = useTranslations('widgets.agent-chat');
    const router = useRouter();
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

    function closeRename(): void {
        setRenaming(null);
        // Return focus to the ✎ button that opened rename mode instead of
        // letting it fall to <body> — the input is about to unmount.
        renameTriggerRef.current?.focus();
    }

    return (
        <nav
            aria-label={t('Sidebar.9a7569')}
            className="flex h-full flex-col gap-2 p-3"
        >
            <a
                href={`${localePrefix}/`}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border-control px-3 text-sm font-medium text-secondary-100 hover:bg-secondary-800 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
            >
                <span aria-hidden="true" className="text-secondary-400">
                    +
                </span>
                {t('Sidebar.newChat')}
            </a>
            <input
                type="search"
                value={filter}
                onChange={e => setFilter(e.target.value)}
                placeholder={t('Sidebar.4cbbe4')}
                aria-label={t('Sidebar.4cbbe4')}
                autoComplete="off"
                className="min-h-9 rounded-lg border border-border-control bg-secondary-900 px-2.5 text-sm text-secondary-100 placeholder:text-secondary-400 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
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
                                    className={cn(
                                        'group flex min-h-9 items-center gap-0.5 rounded-lg pr-1 pl-2 text-sm',
                                        item.id === activeId
                                            ? 'bg-secondary-800 text-secondary-100'
                                            : 'text-secondary-300 hover:bg-secondary-800 hover:text-secondary-100'
                                    )}
                                >
                                    {renaming?.id === item.id ? (
                                        <form
                                            className="flex-1"
                                            onSubmit={async e => {
                                                e.preventDefault();
                                                await renameConversationAction(
                                                    item.id,
                                                    renaming.title
                                                );
                                                closeRename();
                                                router.refresh();
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
                                            aria-current={
                                                item.id === activeId
                                                    ? 'page'
                                                    : undefined
                                            }
                                            className="min-w-0 flex-1 truncate py-1.5 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
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
                                                    await deleteConversationAction(
                                                        item.id
                                                    );
                                                    if (item.id === activeId)
                                                        router.push(
                                                            `${localePrefix}/`
                                                        );
                                                    else router.refresh();
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
                                            <button
                                                type="button"
                                                aria-label={t('Sidebar.73e5a8')}
                                                onClick={e => {
                                                    renameTriggerRef.current =
                                                        e.currentTarget;
                                                    setRenaming({
                                                        id: item.id,
                                                        title: item.title,
                                                    });
                                                }}
                                                className={ROW_ACTION}
                                            >
                                                <span aria-hidden="true">
                                                    ✎
                                                </span>
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
                                                <span aria-hidden="true">
                                                    ✕
                                                </span>
                                            </button>
                                        </>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </section>
                ))}
            </div>
        </nav>
    );
}
