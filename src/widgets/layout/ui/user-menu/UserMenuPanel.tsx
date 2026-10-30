'use client';

import { useTranslations } from 'next-intl';
import { LogoutButton } from '@/features/auth-logout/ui/LogoutButton';
import { TIER_LABEL } from '@/shared/lib/auth/tierLabel';
import { cn } from '@/shared/lib/cn';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import type { HeaderUserMenuUser } from '../../types';
import { TIER_DOT_COLOR } from './tierDotColor';

const ITEM_CLASS =
    'flex w-full items-center rounded px-3 py-2 text-left text-sm text-secondary-200 transition-colors hover:bg-secondary-800 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none';

interface UserMenuPanelProps {
    readonly id: string;
    readonly user: HeaderUserMenuUser;
    readonly onNavigate: () => void;
}

/**
 * 사용자 정보 + 계정 이동 링크 패널.
 *
 * `role="menu"`/`menuitem`을 쓰지 않는다 — 방향키 로빙이 없고 정보 문단이 섞여 있어
 * 메뉴 계약을 지키지 못한다. 사용자 정보는 목록 밖의 평문이고, 항목은 평범한 목록이다
 * (Disclosure Navigation).
 */
export function UserMenuPanel({ id, user, onNavigate }: UserMenuPanelProps) {
    const t = useTranslations('widgets.layout');
    const tierColor = TIER_DOT_COLOR[user.tier];
    // 로그아웃은 링크가 아니라 버튼이라 이 목록 끝에 따로 붙는다.
    const links = [
        { href: '/portfolio', label: t('HeaderUserMenu.myPortfolio') },
        { href: '/email-report', label: t('HeaderUserMenu.411c76') },
        { href: '/account', label: t('HeaderUserMenu.622fae') },
    ];
    return (
        <div
            id={id}
            className="absolute right-0 z-50 mt-2 w-64 rounded-lg border border-secondary-700 bg-secondary-900 p-2 shadow-2xl"
        >
            <div className="border-b border-secondary-700 px-3 py-2 text-sm">
                <p className="font-semibold text-secondary-50">
                    {user.name ?? user.email}
                </p>
                {user.name ? (
                    <p className="text-xs text-secondary-400">{user.email}</p>
                ) : null}
                <p className="mt-1 flex items-center gap-1.5 text-xs text-secondary-400">
                    <span
                        aria-hidden
                        className={cn(
                            'inline-block size-2 rounded-full',
                            tierColor
                        )}
                    />
                    <span>{TIER_LABEL[user.tier]}</span>
                </p>
            </div>
            <ul aria-label={t('HeaderUserMenu.b9a45e')} className="mt-1">
                {links.map(link => (
                    <li key={link.href}>
                        <Link
                            href={link.href}
                            onClick={onNavigate}
                            className={ITEM_CLASS}
                        >
                            {link.label}
                        </Link>
                    </li>
                ))}
                <li>
                    <LogoutButton />
                </li>
            </ul>
        </div>
    );
}
