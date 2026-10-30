'use client';

/** 공유 흐름을 여는 헤더 아이콘 버튼 — 진행 중에는 스피너를 보인다. */

import type { RefObject } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/shared/lib/cn';
import { Spinner } from '@/shared/ui/Spinner';
import { ShareIcon } from '../icons/shareIcons';

interface ShareTriggerButtonProps {
    /** 패널을 닫은 뒤 포커스를 되돌릴 자리. */
    buttonRef: RefObject<HTMLButtonElement | null>;
    /** 공유 스냅샷을 만드는 중이다. */
    pending: boolean;
    /** 안내 문구가 보일 때만 넘기는 `aria-describedby` 대상 id. */
    describedById: string | undefined;
    onClick: () => void;
    /** 포인터가 올라가거나 포커스가 올 때 패널 청크를 미리 받는다. */
    onPreload: () => void;
}

const BUTTON_CLASS = cn(
    'inline-flex size-11 items-center justify-center rounded-lg border border-border-control text-secondary-300',
    'hover:border-primary-500 hover:bg-secondary-700/30 hover:text-secondary-100',
    'focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none',
    'touch-manipulation transition-colors'
);

/**
 * 공유 아이콘 버튼.
 *
 * 진행 중에는 `disabled` 대신 `aria-disabled`로 막는다. 키보드로 누른 버튼이
 * `disabled`가 되면 포커스가 body로 떨어진다(REACT.md#AX-3). 진행 중 클릭은 공유 흐름
 * 훅의 `onClick`이 무시한다.
 */
export function ShareTriggerButton({
    buttonRef,
    pending,
    describedById,
    onClick,
    onPreload,
}: ShareTriggerButtonProps) {
    const t = useTranslations('widgets.share');

    return (
        <button
            ref={buttonRef}
            type="button"
            aria-label={t('ShareButton.281cf1')}
            aria-busy={pending ? 'true' : undefined}
            aria-disabled={pending ? 'true' : undefined}
            aria-describedby={describedById}
            onClick={onClick}
            onPointerEnter={onPreload}
            onFocus={onPreload}
            className={BUTTON_CLASS}
        >
            {pending ? <Spinner size="lg" /> : <ShareIcon className="size-5" />}
        </button>
    );
}
