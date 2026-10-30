'use client';

/**
 * 대화 레일 — 새 대화, 검색, 날짜별 대화 목록(이름 바꾸기·삭제 인라인), 레일 푸터를 배치하는
 * 오케스트레이터. 서버 액션은 `useConversationMutations`, 이동은 `useRailNavigation`, 편집 상태는
 * `useRenameMode`, 행 렌더는 `sidebar/`가 맡는다.
 */
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { ConversationListItem } from '@/entities/chat-conversation/model';
import {
    groupConversationsByDay,
    type ConversationGroupKey,
} from '@/features/agent-chat/lib/groupConversationsByDay';
import { cn } from '@/shared/lib/cn';
import { PlusIcon } from '@/shared/ui/StrokeIcons';
import { AI_RAISED_CONTROL } from './aiSurfaceStyles';
import { useConversationMutations } from './hooks/useConversationMutations';
import { useRailNavigation } from './hooks/useRailNavigation';
import { useRenameMode } from './hooks/useRenameMode';
import { ConversationGroup } from './sidebar/ConversationGroup';
import { ConversationRow } from './sidebar/ConversationRow';
import { GuestRail } from './sidebar/GuestRail';
import { RailFooter } from './sidebar/RailFooter';
import { RenameForm } from './sidebar/RenameForm';

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
    /** Called when an in-app navigation the rail started settles (the mobile drawer closes on it). */
    readonly onNavigate?: () => void;
    /**
     * 사이드바가 다른 화면으로 이동을 **시작한 순간** 목적지 href와 함께 불린다.
     * `onNavigate`(전환이 끝난 뒤)와 짝을 이룬다 — 본문이 그 사이에 골격을 그린다.
     */
    readonly onNavigationStart?: (href: string) => void;
}

/**
 * Conversation rail. Grouped by day the way chat products do, with rename and
 * delete inline (delete needs a second click — no modal, no accidental loss).
 * The rail's own controls are quiet by design: the conversation column is the
 * product, this is its table of contents.
 *
 * 지운 대화는 열려 있던 것이어도 목록에서 바로 뺀다 — 랜딩(`/`)에서 만든 대화는 새 대화로
 * 이동해도 화면이 다시 마운트되지 않아(같은 라우트) 목록 갱신을 이동에 맡기면 지운 행이 남았다.
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
    onNavigationStart,
}: Props) {
    const t = useTranslations('widgets.agent-chat');
    const [filter, setFilter] = useState('');
    const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(
        null
    );
    const rename = useRenameMode();
    const mutations = useConversationMutations({ onRenamed, onDeleted });
    const rail = useRailNavigation({ onNavigationStart, onNavigate });
    const newChatHref = `${localePrefix}/`;
    const hrefOf = (id: string): string => `${localePrefix}/c/${id}`;

    if (!signedIn) {
        return (
            <GuestRail
                loginHref={loginHref}
                siteUrl={siteUrl}
                localePrefix={localePrefix}
            />
        );
    }

    const groupLabel: Record<ConversationGroupKey, string> = {
        today: t('Sidebar.groupToday'),
        yesterday: t('Sidebar.groupYesterday'),
        week: t('Sidebar.groupWeek'),
        older: t('Sidebar.groupOlder'),
    };
    const groups = groupConversationsByDay(
        items.filter(i => i.title.toLowerCase().includes(filter.toLowerCase()))
    );
    const failureCopy = {
        rename: t('Sidebar.renameFailed'),
        delete: t('Sidebar.deleteFailed'),
    } as const;
    const failureMessage =
        mutations.failure === null ? null : failureCopy[mutations.failure];

    const submitRename = (item: ConversationListItem): void => {
        const title = rename.draft?.title.trim() ?? '';
        rename.close();
        if (title.length === 0 || title === item.title) return;
        void mutations.rename(item.id, item.title, title);
    };

    const confirmDelete = async (item: ConversationListItem): Promise<void> => {
        setConfirmingDeleteId(null);
        const deleted = await mutations.remove(item.id);
        if (deleted && item.id === activeId)
            rail.startNavigationTo(newChatHref);
    };

    return (
        <nav
            aria-label={t('Sidebar.9a7569')}
            className="flex h-full flex-col gap-2 p-3"
        >
            <a
                href={newChatHref}
                onClick={e => rail.navigate(e, newChatHref)}
                aria-busy={rail.isPending(newChatHref) || undefined}
                className={cn(
                    AI_RAISED_CONTROL,
                    'inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium text-secondary-100 aria-[busy=true]:cursor-progress aria-[busy=true]:text-secondary-400'
                )}
            >
                <PlusIcon className="size-4 text-primary-400" />
                {t('Sidebar.newChat')}
            </a>
            <p role="status" className="sr-only">
                {rail.isNavigating ? t('Sidebar.navigating') : ''}
            </p>
            <input
                type="search"
                value={filter}
                onChange={e => setFilter(e.target.value)}
                placeholder={t('Sidebar.4cbbe4')}
                aria-label={t('Sidebar.4cbbe4')}
                autoComplete="off"
                className="min-h-9 rounded-lg border border-border-control bg-transparent px-2.5 text-sm text-secondary-100 placeholder:text-secondary-400 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
            />
            {failureMessage !== null && (
                <p role="alert" className="px-1 text-xs text-ui-danger-text">
                    {failureMessage}
                </p>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto">
                {groups.length === 0 ? (
                    <p className="px-2 pt-6 text-center text-sm text-secondary-400">
                        {items.length === 0
                            ? t('Sidebar.empty')
                            : t('Sidebar.noMatch')}
                    </p>
                ) : null}
                {groups.map(group => (
                    <ConversationGroup
                        key={group.key}
                        label={groupLabel[group.key]}
                    >
                        {group.items.map(item => {
                            const isRenaming = rename.draft?.id === item.id;
                            return (
                                <ConversationRow
                                    key={item.id}
                                    item={item}
                                    href={hrefOf(item.id)}
                                    isActive={item.id === activeId}
                                    isPending={rail.isPending(hrefOf(item.id))}
                                    isRenaming={isRenaming}
                                    isConfirmingDelete={
                                        confirmingDeleteId === item.id
                                    }
                                    rowRef={
                                        isRenaming ? rename.rowRef : undefined
                                    }
                                    renameForm={
                                        isRenaming ? (
                                            <RenameForm
                                                value={
                                                    rename.draft?.title ?? ''
                                                }
                                                inputRef={rename.inputRef}
                                                onChange={rename.change}
                                                onSubmit={() =>
                                                    submitRename(item)
                                                }
                                                onCancel={rename.close}
                                            />
                                        ) : null
                                    }
                                    onNavigate={e =>
                                        rail.navigate(e, hrefOf(item.id))
                                    }
                                    onToggleRename={trigger =>
                                        isRenaming
                                            ? rename.close()
                                            : rename.open(
                                                  item.id,
                                                  item.title,
                                                  trigger
                                              )
                                    }
                                    onAskDelete={() =>
                                        setConfirmingDeleteId(item.id)
                                    }
                                    onConfirmDelete={() =>
                                        void confirmDelete(item)
                                    }
                                    onCancelDelete={() =>
                                        setConfirmingDeleteId(null)
                                    }
                                />
                            );
                        })}
                    </ConversationGroup>
                ))}
            </div>
            <RailFooter siteUrl={siteUrl} localePrefix={localePrefix} />
        </nav>
    );
}
