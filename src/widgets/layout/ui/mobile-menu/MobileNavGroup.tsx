'use client';

import { useTranslations } from 'next-intl';
import type { NavVerticalNode } from '../../utils/headerNavTree';
import { isHrefActive } from '../../utils/navActiveState';
import { MobileNavLink } from './MobileNavLink';

interface MobileNavGroupProps {
    readonly vertical: NavVerticalNode;
    readonly pathname: string | null;
    readonly onNavigate: () => void;
}

/**
 * 버티컬 1개의 드로어 섹션 — 제목 + 펼쳐진 지역·하위 링크.
 *
 * 데스크톱은 드롭다운이지만 드로어는 **펼친 채로** 둔다. 좁은 화면의 2단 접힘 메뉴는 목적지
 * 하나에 탭 두 번을 요구하고 열림 상태를 버티컬마다 따로 관리해야 하는 반면, 수직 공간은 남는다.
 *
 * 그룹에 이름을 붙인다(`role="group"` + `aria-labelledby`). 지역 라벨이 짧아(`미국`/`한국`)
 * 버티컬마다 반복되므로, 이름이 없으면 스크린리더에는 같은 이름의 링크 8개가 이어진다.
 * 제목은 지역 링크(14px)보다 크고 밝게 해 그룹 경계가 시각적으로도 읽히게 한다.
 */
export function MobileNavGroup({
    vertical,
    pathname,
    onNavigate,
}: MobileNavGroupProps) {
    // 내비 라벨 키는 네임스페이스까지 포함된 완전 수식 키라 루트로 푼다.
    const tNav = useTranslations();
    const headingId = `mobile-nav-group-${vertical.id}`;
    return (
        <div
            role="group"
            aria-labelledby={headingId}
            className="border-t border-secondary-700 py-2 first:border-t-0"
        >
            <p
                id={headingId}
                className="px-4 pt-1 pb-2 text-sm font-bold tracking-wide text-secondary-100"
            >
                {tNav(vertical.labelKey)}
            </p>
            {vertical.overview && (
                <MobileNavLink
                    href={vertical.overview.href}
                    label={tNav(vertical.overview.labelKey)}
                    active={isHrefActive(vertical.overview.href, pathname)}
                    onNavigate={onNavigate}
                />
            )}
            {vertical.regions.map(region => (
                <div key={region.href}>
                    <MobileNavLink
                        href={region.href}
                        label={tNav(region.labelKey)}
                        active={isHrefActive(region.href, pathname)}
                        onNavigate={onNavigate}
                    />
                    {region.children.map(leaf => (
                        <MobileNavLink
                            key={leaf.href}
                            href={leaf.href}
                            label={tNav(leaf.labelKey)}
                            active={isHrefActive(leaf.href, pathname)}
                            onNavigate={onNavigate}
                            indented
                        />
                    ))}
                </div>
            ))}
        </div>
    );
}
