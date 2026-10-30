'use client';

/**
 * 대화 목록의 한 행 — 대화 링크(또는 이름 바꾸기 폼)와 ✎·🗑 행 동작, 삭제 확인.
 */
import { useTranslations } from 'next-intl';
import type { MouseEvent, ReactNode, Ref } from 'react';
import type { ConversationListItem } from '@/entities/chat-conversation/model';
import { cn } from '@/shared/lib/cn';
import { CloseIcon, PencilIcon, TrashIcon } from '@/shared/ui/StrokeIcons';

/** 아이콘 행 동작 — 언제나 닿지만, 넓은 화면에서는 hover/focus 때만 떠올라 목록이 목록으로 읽힌다. */
const ROW_ACTION =
    'inline-flex size-7 shrink-0 items-center justify-center rounded text-secondary-400 hover:bg-secondary-700 hover:text-secondary-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100';

interface ConversationRowProps {
    readonly item: ConversationListItem;
    readonly href: string;
    readonly isActive: boolean;
    readonly isPending: boolean;
    readonly isRenaming: boolean;
    readonly isConfirmingDelete: boolean;
    /** 이름 바꾸기 중일 때만 붙는 행 ref — 이 밖을 누르면 편집이 취소된다. */
    readonly rowRef?: Ref<HTMLLIElement>;
    /** 이름 바꾸기 중일 때 링크 자리에 들어가는 폼. */
    readonly renameForm: ReactNode;
    readonly onNavigate: (event: MouseEvent<HTMLAnchorElement>) => void;
    readonly onToggleRename: (trigger: HTMLButtonElement) => void;
    readonly onAskDelete: () => void;
    readonly onConfirmDelete: () => void;
    readonly onCancelDelete: () => void;
}

/** 행 하나를 그린다. 상태는 모두 부모(`Sidebar`)가 쥔다. */
export function ConversationRow({
    item,
    href,
    isActive,
    isPending,
    isRenaming,
    isConfirmingDelete,
    rowRef,
    renameForm,
    onNavigate,
    onToggleRename,
    onAskDelete,
    onConfirmDelete,
    onCancelDelete,
}: ConversationRowProps) {
    const t = useTranslations('widgets.agent-chat');
    return (
        <li
            ref={rowRef}
            className={cn(
                'group relative flex min-h-9 items-center gap-0.5 rounded-lg pr-1 pl-2.5 text-sm',
                isActive
                    ? 'bg-secondary-800 text-secondary-100 before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-primary-400'
                    : 'text-secondary-300 hover:bg-secondary-800 hover:text-secondary-100'
            )}
        >
            {isRenaming ? (
                renameForm
            ) : (
                <a
                    href={href}
                    onClick={onNavigate}
                    aria-current={isActive ? 'page' : undefined}
                    aria-busy={isPending || undefined}
                    className="min-w-0 flex-1 truncate py-1.5 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none aria-[busy=true]:cursor-progress aria-[busy=true]:text-secondary-400"
                >
                    {item.title}
                </a>
            )}
            {isConfirmingDelete ? (
                <span className="flex items-center gap-1 text-xs whitespace-nowrap text-ui-danger-text">
                    {t('Sidebar.14bb5e')}
                    <button
                        type="button"
                        onClick={onConfirmDelete}
                        className="rounded px-1 font-medium underline focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                    >
                        {t('Sidebar.fc81e2')}
                    </button>
                    <button
                        type="button"
                        onClick={onCancelDelete}
                        className="rounded px-1 text-secondary-300 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                    >
                        {t('Sidebar.19b2d1')}
                    </button>
                </span>
            ) : (
                <>
                    {/* 바꿔 끼우는 두 버튼이 아니라 토글 하나 — 버튼이 계속 마운트돼 있어
                        편집을 닫을 때 포커스를 돌려줄 수 있다. 편집 중엔 계속 보인다:
                        Escape 말고 화면에 있는 유일한 나가는 길이다. */}
                    <button
                        type="button"
                        aria-label={
                            isRenaming
                                ? t('Sidebar.renameCancel')
                                : t('Sidebar.73e5a8')
                        }
                        onClick={e => onToggleRename(e.currentTarget)}
                        className={cn(
                            ROW_ACTION,
                            isRenaming && 'sm:opacity-100'
                        )}
                    >
                        {isRenaming ? (
                            <CloseIcon className="size-3.5" />
                        ) : (
                            <PencilIcon className="size-3.5" />
                        )}
                    </button>
                    <button
                        type="button"
                        aria-label={t('Sidebar.fc81e2')}
                        onClick={onAskDelete}
                        className={ROW_ACTION}
                    >
                        <TrashIcon className="size-3.5" />
                    </button>
                </>
            )}
        </li>
    );
}
