'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import {
    deleteConversationAction,
    renameConversationAction,
    type ConversationListItem,
} from '@/entities/chat-conversation/actions';
import { cn } from '@/shared/lib/cn';

interface Props {
    readonly items: ConversationListItem[];
    readonly activeId: string | null;
    readonly localePrefix: string;
}

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
                className="border-control rounded-lg border px-3 py-2 text-sm text-secondary-100 hover:bg-secondary-800 focus-visible:ring-2 focus-visible:ring-primary-500"
            >
                {t('Sidebar.cd889e')}
            </a>
            <input
                value={filter}
                onChange={e => setFilter(e.target.value)}
                placeholder={t('Sidebar.4cbbe4')}
                aria-label={t('Sidebar.4cbbe4')}
                className="border-control rounded border bg-secondary-900 px-2 py-1 text-sm text-secondary-100 focus-visible:ring-2 focus-visible:ring-primary-500"
            />
            <ul className="flex-1 space-y-1 overflow-y-auto">
                {visible.map(item => (
                    <li
                        key={item.id}
                        className={cn(
                            'group flex items-center gap-1 rounded px-2 py-1 text-sm',
                            item.id === activeId
                                ? 'bg-secondary-800 text-secondary-100'
                                : 'text-secondary-300 hover:bg-secondary-800'
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
                                    className="w-full rounded bg-secondary-900 px-1 text-secondary-100"
                                />
                            </form>
                        ) : (
                            <a
                                href={`${localePrefix}/c/${item.id}`}
                                className="flex-1 truncate focus-visible:ring-2 focus-visible:ring-primary-500"
                            >
                                {item.title}
                            </a>
                        )}
                        <button
                            type="button"
                            aria-label={t('Sidebar.73e5a8')}
                            onClick={e => {
                                renameTriggerRef.current = e.currentTarget;
                                setRenaming({
                                    id: item.id,
                                    title: item.title,
                                });
                            }}
                            className="rounded px-1 text-xs opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-primary-500"
                        >
                            ✎
                        </button>
                        {confirmingDeleteId === item.id ? (
                            <span className="flex items-center gap-1 text-xs whitespace-nowrap text-ui-danger-text">
                                {t('Sidebar.14bb5e')}
                                <button
                                    type="button"
                                    onClick={async () => {
                                        setConfirmingDeleteId(null);
                                        await deleteConversationAction(item.id);
                                        if (item.id === activeId)
                                            router.push(`${localePrefix}/`);
                                        else router.refresh();
                                    }}
                                    className="rounded px-1 font-medium underline focus-visible:ring-2 focus-visible:ring-primary-500"
                                >
                                    {t('Sidebar.fc81e2')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setConfirmingDeleteId(null)}
                                    className="rounded px-1 text-secondary-300 focus-visible:ring-2 focus-visible:ring-primary-500"
                                >
                                    {t('Sidebar.19b2d1')}
                                </button>
                            </span>
                        ) : (
                            <button
                                type="button"
                                aria-label={t('Sidebar.fc81e2')}
                                onClick={() => setConfirmingDeleteId(item.id)}
                                className="rounded px-1 text-xs opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-primary-500"
                            >
                                ✕
                            </button>
                        )}
                    </li>
                ))}
            </ul>
        </nav>
    );
}
