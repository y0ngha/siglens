'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/shared/lib/cn';
import type { NavVerticalNode } from '../../utils/headerNavTree';
import { isHrefActive } from '../../utils/navActiveState';
import { NavPanelLink } from './NavPanelLink';

interface NavMenuPanelProps {
    readonly id: string;
    readonly vertical: NavVerticalNode;
    readonly pathname: string | null;
    readonly isOpen: boolean;
    readonly onNavigate: () => void;
}

/**
 * 버티컬 1개의 지역/목적지 링크 패널.
 *
 * **닫혀 있어도 DOM에 남는다.** 이 헤더는 전 페이지에 렌더되므로 지역 페이지로 가는 사실상
 * 유일한 전역 앵커라, 조건부 렌더로 감추면 크롤러가 링크를 못 본다. 감추는 수단이
 * `visibility: hidden`(`invisible`)인 이유도 같다 — `display:none`과 달리 접근성 트리에서는
 * 빠지되 마크업에는 남고, `opacity`만 쓰는 것과 달리 닫힌 상태에서 탭 포커스가 들어가지 않는다.
 *
 * `role="menu"`를 쓰지 않는다. 여기 있는 것은 전부 페이지 이동 링크라 올바른 패턴은 APG의
 * Disclosure Navigation(버튼 `aria-expanded` + 평범한 링크 목록)이다.
 *
 * 2단 구조: 지역 밑에 최종 목적지가 여럿이면(뉴스 미국) 함께 펼쳐 한 클릭으로 도착하게 한다.
 */
export function NavMenuPanel({
    id,
    vertical,
    pathname,
    isOpen,
    onNavigate,
}: NavMenuPanelProps) {
    // 내비 라벨 키는 네임스페이스까지 포함된 완전 수식 키라 루트 번역자로 푼다.
    const tNav = useTranslations();
    const t = useTranslations('widgets.layout');
    return (
        <ul
            id={id}
            aria-label={t('HeaderNavMenu.shortcutLabel', {
                v0: tNav(vertical.labelKey),
            })}
            className={cn(
                'absolute top-full left-0 z-50 min-w-44 rounded-lg border border-secondary-700 bg-secondary-900 py-1 shadow-xl',
                isOpen ? 'visible' : 'invisible'
            )}
        >
            {vertical.overview && (
                // 구분선은 컨트롤(링크)이 아니라 항목 칸이 맡는다 — 개요와 아래 지역
                // 목록을 가르는 줄일 뿐, 링크의 경계는 상태 채움이 맡는다.
                <li className="border-b border-secondary-700">
                    <NavPanelLink
                        href={vertical.overview.href}
                        label={tNav(vertical.overview.labelKey)}
                        active={isHrefActive(vertical.overview.href, pathname)}
                        tone="overview"
                        onNavigate={onNavigate}
                    />
                </li>
            )}
            {vertical.regions.map(region => (
                <li key={region.href}>
                    <NavPanelLink
                        href={region.href}
                        label={tNav(region.labelKey)}
                        active={isHrefActive(region.href, pathname)}
                        tone="region"
                        onNavigate={onNavigate}
                    />
                    {region.children.length > 0 && (
                        <ul className="pb-1">
                            {region.children.map(leaf => (
                                <li key={leaf.href}>
                                    <NavPanelLink
                                        href={leaf.href}
                                        label={tNav(leaf.labelKey)}
                                        active={isHrefActive(
                                            leaf.href,
                                            pathname
                                        )}
                                        tone="leaf"
                                        onNavigate={onNavigate}
                                    />
                                </li>
                            ))}
                        </ul>
                    )}
                </li>
            ))}
        </ul>
    );
}
