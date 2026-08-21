'use client';

import { useTranslations } from 'next-intl';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import {
    useEffect,
    useId,
    useRef,
    useState,
    type PointerEvent as ReactPointerEvent,
} from 'react';
import { cn } from '@/shared/lib/cn';
import { useEscapeKey } from '@/shared/hooks/useEscapeKey';
import type { NavVerticalNode } from './headerNavTree';
import { isHrefActive, isVerticalActive } from './navActiveState';

interface HeaderNavMenuProps {
    readonly vertical: NavVerticalNode;
    /** 현재 경로. 정적 fallback(`HeaderNavStatic`)은 `null`을 넘겨 활성 표시를 끈다. */
    readonly pathname: string | null;
}

const ITEM_BASE =
    'flex min-h-11 touch-manipulation items-center text-xs font-semibold tracking-[0.08em] transition-colors focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none focus-visible:-outline-offset-2';

/**
 * 데스크톱 헤더의 버티컬 1개 = 트리거 버튼 + 지역/목적지 패널.
 *
 * **패널은 닫혀 있어도 DOM에 남는다.** 이 헤더는 전 페이지에 렌더되므로 신규 지역
 * 페이지(`/market/kr` 등)로 가는 사실상 유일한 전역 앵커다. 조건부 렌더로 감추면
 * 크롤러가 그 링크를 영영 못 본다. 감추는 수단으로 `visibility: hidden`(Tailwind
 * `invisible`)을 쓰는 이유도 같다 — `display:none`과 달리 접근성 트리에서는 빠지되
 * 마크업에는 남고, `opacity`만 쓰는 것과 달리 닫힌 상태에서 탭 포커스가 들어가지
 * 않는다. `tabIndex={-1}`을 링크마다 수동으로 붙이는 것보다 회귀에 강하다.
 *
 * **2단 구조**: 지역 밑에 최종 목적지가 여럿이면(뉴스 미국) 그 목적지들을 함께
 * 펼친다 — 허브를 한 번 더 거치지 않고 한 클릭으로 도착하게 하는 것이 이 메뉴의
 * 존재 이유다.
 */
export function HeaderNavMenu({ vertical, pathname }: HeaderNavMenuProps) {
    // 내비 라벨 키는 완전 수식이라 루트 네임스페이스로 푼다.
    const tNav = useTranslations();
    const t = useTranslations('widgets.layout');
    const [isOpen, setIsOpen] = useState(false);
    const panelId = useId();
    const containerRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);

    const close = () => setIsOpen(false);
    const closeAndRefocus = () => {
        setIsOpen(false);
        triggerRef.current?.focus();
    };

    useEscapeKey(closeAndRefocus, isOpen);

    // 바깥 클릭으로 닫기. `pointerdown`은 클릭이 완료되기 전에 발생해, 다른 트리거를
    // 눌렀을 때 "이전 것 닫기 → 새 것 열기"가 한 번의 상호작용으로 끝난다.
    useEffect(() => {
        if (!isOpen) return;
        const onPointerDown = (event: PointerEvent) => {
            const container = containerRef.current;
            if (!container) return;
            if (
                event.target instanceof Node &&
                container.contains(event.target)
            ) {
                return;
            }
            setIsOpen(false);
        };
        document.addEventListener('pointerdown', onPointerDown);
        return () => document.removeEventListener('pointerdown', onPointerDown);
    }, [isOpen]);

    /*
     * 마우스 호버로도 열린다 — 클릭 없이 훑어볼 수 있어야 메뉴를 "탐색"할 수 있다.
     *
     * `pointerType === 'mouse'` 가드가 핵심이다. 터치에서는 탭 한 번이
     * pointerenter → click 순서로 둘 다 발생하므로, 가드가 없으면 호버가 열고
     * 클릭 토글이 곧바로 닫아 **메뉴가 절대 열리지 않는다**. 펜(`'pen'`)도
     * 같은 이유로 제외한다.
     *
     * 컨테이너에 걸었으므로 트리거와 패널 사이에 빈틈이 없다 — 트리거에서 패널로
     * 내려가는 동안 leave가 발생하지 않아 닫힘 지연 타이머가 필요 없다.
     */
    const onPointerEnter = (event: ReactPointerEvent) => {
        if (event.pointerType === 'mouse') setIsOpen(true);
    };
    const onPointerLeave = (event: ReactPointerEvent) => {
        if (event.pointerType === 'mouse') setIsOpen(false);
    };

    return (
        <div
            ref={containerRef}
            className="relative"
            onPointerEnter={onPointerEnter}
            onPointerLeave={onPointerLeave}
        >
            <button
                ref={triggerRef}
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setIsOpen(v => !v)}
                className={cn(
                    '-mb-px flex min-h-11 touch-manipulation items-center gap-1 border-b-2 px-2 text-xs font-semibold tracking-[0.12em] uppercase transition-colors focus-visible:rounded focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none',
                    isVerticalActive(vertical, pathname)
                        ? 'border-primary-500 text-secondary-100'
                        : 'border-transparent text-secondary-400 hover:text-secondary-100'
                )}
            >
                {tNav(vertical.labelKey)}
                <span
                    aria-hidden="true"
                    className={cn(
                        'text-[0.6rem] transition-transform',
                        isOpen && 'rotate-180'
                    )}
                >
                    ▾
                </span>
            </button>
            {/*
                `role="menu"`를 **쓰지 않는다.** ARIA APG에서 `menu`/`menuitem`은
                애플리케이션 명령 메뉴(잘라내기·붙여넣기 같은 동작)를 위한 역할이라,
                스크린리더가 애플리케이션 모드로 전환하고 링크를 "메뉴 항목"으로
                읽는다. 여기 있는 것은 전부 페이지 이동 링크이므로 올바른 패턴은
                APG의 **Disclosure Navigation**이다: 버튼이 `aria-expanded`로 상태를
                알리고, 패널은 평범한 링크 목록으로 둔다.
            */}
            <ul
                id={panelId}
                aria-label={t('HeaderNavMenu.shortcutLabel', {
                    v0: tNav(vertical.labelKey),
                })}
                className={cn(
                    'absolute top-full left-0 z-50 min-w-44 rounded-md border border-secondary-700 bg-secondary-900 py-1 shadow-xl',
                    isOpen ? 'visible' : 'invisible'
                )}
            >
                {vertical.overview && (
                    <li>
                        <Link
                            href={vertical.overview.href}
                            prefetch={false}
                            aria-current={
                                isHrefActive(vertical.overview.href, pathname)
                                    ? 'page'
                                    : undefined
                            }
                            onClick={close}
                            className={cn(
                                ITEM_BASE,
                                'border-b border-secondary-800 px-4',
                                isHrefActive(vertical.overview.href, pathname)
                                    ? 'bg-secondary-800 text-secondary-100'
                                    : 'text-secondary-400 hover:bg-secondary-800 hover:text-secondary-100'
                            )}
                        >
                            {tNav(vertical.overview.labelKey)}
                        </Link>
                    </li>
                )}
                {vertical.regions.map(region => (
                    <li key={region.href}>
                        <Link
                            href={region.href}
                            // 전역 헤더 링크 — prefetch는 진입 페이지마다 다른 `_rsc`
                            // 해시를 만들어 CDN 캐시를 파편화시킨다
                            // (docs/architecture/CDN_CACHING.md §1).
                            prefetch={false}
                            aria-current={
                                isHrefActive(region.href, pathname)
                                    ? 'page'
                                    : undefined
                            }
                            onClick={close}
                            className={cn(
                                ITEM_BASE,
                                'px-4',
                                isHrefActive(region.href, pathname)
                                    ? 'bg-secondary-800 text-secondary-100'
                                    : 'text-secondary-400 hover:bg-secondary-800 hover:text-secondary-100'
                            )}
                        >
                            {tNav(region.labelKey)}
                        </Link>
                        {region.children.length > 0 && (
                            <ul className="pb-1">
                                {region.children.map(leaf => (
                                    <li key={leaf.href}>
                                        <Link
                                            href={leaf.href}
                                            prefetch={false}
                                            aria-current={
                                                isHrefActive(
                                                    leaf.href,
                                                    pathname
                                                )
                                                    ? 'page'
                                                    : undefined
                                            }
                                            onClick={close}
                                            className={cn(
                                                ITEM_BASE,
                                                // 들여쓰기로 계층을 표현한다. 지역 링크와
                                                // 같은 눈금에 두면 `미국`과 `미국 주식`이
                                                // 형제로 보여 무엇이 상위인지 사라진다.
                                                'pr-4 pl-7 font-normal',
                                                isHrefActive(
                                                    leaf.href,
                                                    pathname
                                                )
                                                    ? 'bg-secondary-800 text-secondary-100'
                                                    : 'text-secondary-500 hover:bg-secondary-800 hover:text-secondary-200'
                                            )}
                                        >
                                            {tNav(leaf.labelKey)}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    );
}
