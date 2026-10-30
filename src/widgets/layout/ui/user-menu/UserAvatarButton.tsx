'use client';

import Image from 'next/image';
import type { Ref } from 'react';
import { useTranslations } from 'next-intl';
import { TIER_LABEL } from '@/shared/lib/auth/tierLabel';
import { cn } from '@/shared/lib/cn';
import type { HeaderUserMenuUser } from '../../types';
import { getUserInitial } from '../../utils/userInitial';
import { TIER_DOT_COLOR } from './tierDotColor';

interface UserAvatarButtonProps {
    readonly ref: Ref<HTMLButtonElement>;
    readonly user: HeaderUserMenuUser;
    readonly isOpen: boolean;
    readonly panelId: string;
    readonly onClick: () => void;
}

/**
 * 사용자 메뉴의 공개 토글 버튼(아바타 + 티어 점).
 *
 * 패널은 명령 메뉴가 아니라 페이지 이동 링크 목록이므로 `aria-haspopup="menu"` 없이
 * `aria-expanded`만 단다(Disclosure 패턴).
 */
export function UserAvatarButton({
    ref,
    user,
    isOpen,
    panelId,
    onClick,
}: UserAvatarButtonProps) {
    const t = useTranslations('widgets.layout');
    return (
        <button
            ref={ref}
            type="button"
            onClick={onClick}
            aria-expanded={isOpen}
            aria-controls={isOpen ? panelId : undefined}
            aria-label={t('HeaderUserMenu.menuLabel', {
                v0: TIER_LABEL[user.tier],
            })}
            className="relative flex size-10 items-center justify-center rounded-full bg-secondary-800 text-sm font-semibold text-secondary-100 transition-colors hover:bg-secondary-700 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
        >
            {user.avatarUrl ? (
                <Image
                    src={user.avatarUrl}
                    alt={t('HeaderUserMenu.3a7424')}
                    width={40}
                    height={40}
                    className="size-full rounded-full object-cover"
                />
            ) : (
                <span aria-hidden>{getUserInitial(user)}</span>
            )}
            {/* 아바타 위 티어 점을 헤더 배경(`bg-secondary-900/90`)에서 오려내는 할로 링 —
                경계선이 아니라 주변 표면과 같은 색이어야 점만 떠 보인다. */}
            <span
                aria-hidden
                className={cn(
                    'ring-secondary-900 absolute -right-0.5 -bottom-0.5 size-3 rounded-full ring-2',
                    TIER_DOT_COLOR[user.tier]
                )}
            />
        </button>
    );
}
