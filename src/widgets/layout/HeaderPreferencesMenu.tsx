'use client';

import { useId } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/shared/lib/cn';
import { SURFACE_FLOATING } from '@/shared/lib/surfaceStyles';
import { TranslateIcon } from '@/shared/ui/StrokeIcons';
import { usePopoverDisclosure } from './hooks/usePopoverDisclosure';
import { PreferencesSection } from './ui/preferences/PreferencesSection';

/**
 * 비회원의 언어·테마 설정 진입점 — 文A 아이콘 버튼 하나와 그 패널.
 *
 * 회원은 같은 섹션을 아바타 메뉴 안에서 쓴다(`UserMenuPanel`). 비회원에게도 아바타 모양을 쓰지
 * 않는 이유는 로그인한 것처럼 읽히기 때문이고, 아이콘이 文A인 이유는 처음 온 해외 방문자가
 * 화면 글자를 못 읽어도 "언어"로 알아보는 모양이어야 하기 때문이다. 테마는 자주 바꾸는 설정이
 * 아니라 같은 패널 안에 둔다.
 *
 * 패널은 Disclosure 패턴이다 — 명령 메뉴가 아니라 두 라디오그룹을 담은 영역이라 `aria-haspopup`
 * 없이 `aria-expanded`만 단다. 포털을 쓰지 않는다: 사이트 헤더는 `sticky z-50`(최상위)이라
 * 덮일 스택 컨텍스트 함정이 없다.
 */
export function HeaderPreferencesMenu() {
    const t = useTranslations('widgets.layout');
    const { containerRef, triggerRef, isOpen, close, toggle } =
        usePopoverDisclosure();
    const panelId = useId();
    const label = t('preferences.trigger');

    return (
        <div ref={containerRef} className="relative inline-flex shrink-0">
            <button
                ref={triggerRef}
                type="button"
                onClick={toggle}
                aria-expanded={isOpen}
                aria-controls={isOpen ? panelId : undefined}
                aria-label={label}
                title={label}
                className="flex size-11 items-center justify-center rounded-lg text-secondary-400 transition-colors hover:text-secondary-200 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
            >
                <TranslateIcon className="size-5 shrink-0" />
            </button>
            {isOpen && (
                <div
                    id={panelId}
                    className={cn(
                        SURFACE_FLOATING,
                        'absolute top-full right-0 z-10 mt-1 w-56 p-1 shadow-lg'
                    )}
                >
                    <PreferencesSection onLocaleSelect={close} />
                </div>
            )}
        </div>
    );
}
