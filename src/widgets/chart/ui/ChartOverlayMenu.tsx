'use client';

import { useTranslations } from 'next-intl';
import { useId, useRef } from 'react';
import type { OverlayKind } from '@y0ngha/siglens-core';
import { useEscapeKey } from '@/shared/hooks/useEscapeKey';
import { useFocusTrap } from '@/shared/hooks/useFocusTrap';
import { usePopoverToggle } from '@/shared/hooks/usePopoverToggle';
import { cn } from '@/shared/lib/cn';
import { CHART_OVERLAY_KINDS } from '../model/chartOverlayCategories';

interface ChartOverlayMenuProps {
    counts: Readonly<Record<OverlayKind, number>>;
    visible: Readonly<Record<OverlayKind, boolean>>;
    onToggle: (kind: OverlayKind) => void;
}

const KIND_LABEL_KEY: Record<OverlayKind, string> = {
    pattern: 'ChartOverlayMenu.bdeea2',
    trendline: 'ChartOverlayMenu.0b5eb6',
    divergence: 'ChartOverlayMenu.67eb73',
    fibonacci: 'ChartOverlayMenu.2bac73',
    elliott: 'ChartOverlayMenu.3b6851',
};

/**
 * "차트 작도" 드롭다운 — AI가 참조한 로직 작도(패턴·추세선·다이버전스·피보나치·
 * 엘리어트 파동)를 카테고리별로 켜고 끈다.
 *
 * `role="menu"`/`menuitemcheckbox`가 아니라 **레이블된 토글 그룹**이다 — ARIA
 * menu 패턴은 방향키 내비게이션·roving tabindex를 요구하는데(WAI-ARIA APG),
 * 여기 항목은 하나의 값(불리언)을 고르는 순수 토글일 뿐 메뉴가 열어야 할
 * "명령 목록"이 아니다. 의미가 안 맞는 role을 강제로 붙이는 대신 `role="group"`
 * + `aria-label` 컨테이너 안에 평범한 `<button aria-pressed>`를 두어, 스크린
 * 리더가 각 항목을 독립된 토글 버튼으로 읽고 Tab으로 순서대로 오갈 수 있게
 * 한다. 같은 32px 헤더 띠의 `IndicatorSettingsModal`(네이티브 `<dialog>`)과
 * 달리 여기는 앵커드 패널을 직접 그린다(`usePopoverToggle` + `useFocusTrap` +
 * `useEscapeKey`는 `AnalysisSettingsMenu`와 동일하게 재사용) — `PopoverSurface`는
 * 패널에 `role="dialog"`를 강제해 이 그룹 시맨틱과 맞지 않는다.
 */
export function ChartOverlayMenu({
    counts,
    visible,
    onToggle,
}: ChartOverlayMenuProps) {
    const t = useTranslations('widgets.chart');
    const triggerRef = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const panelId = useId();
    const { isOpen, toggle, close } = usePopoverToggle([triggerRef, panelRef]);

    useFocusTrap(panelRef, isOpen);
    useEscapeKey(close, isOpen);

    const kinds = CHART_OVERLAY_KINDS.filter(kind => counts[kind] > 0);
    const activeCount = kinds.filter(kind => visible[kind]).length;

    if (kinds.length === 0) return null;

    const triggerLabel = t('ChartOverlayMenu.4b1cdc', { v0: activeCount });

    return (
        <div className="relative">
            <button
                ref={triggerRef}
                type="button"
                onClick={toggle}
                aria-expanded={isOpen}
                aria-controls={panelId}
                className="relative flex h-7 touch-manipulation items-center gap-1 rounded-lg px-2 text-xs text-secondary-400 transition-colors before:absolute before:-inset-2 before:content-[''] hover:bg-secondary-700/90 hover:text-white focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:outline-none"
            >
                <span>{triggerLabel}</span>
                <span aria-hidden="true">▾</span>
            </button>

            {isOpen && (
                <div
                    ref={panelRef}
                    id={panelId}
                    role="group"
                    aria-label={triggerLabel}
                    tabIndex={-1}
                    className={cn(
                        'absolute top-full right-0 z-50 mt-1 w-48 max-w-[calc(100vw-1rem)]',
                        'flex flex-col gap-0.5 rounded-lg border border-secondary-700 bg-secondary-900 p-1.5 shadow-2xl outline-none'
                    )}
                >
                    {kinds.map(kind => (
                        <button
                            key={kind}
                            type="button"
                            aria-pressed={visible[kind]}
                            onClick={() => onToggle(kind)}
                            className={cn(
                                'flex items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors',
                                'focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:outline-none',
                                visible[kind]
                                    ? 'bg-secondary-700 text-secondary-50'
                                    : 'text-secondary-400 hover:bg-secondary-700 hover:text-secondary-50'
                            )}
                        >
                            <span>
                                {t(KIND_LABEL_KEY[kind])} ({counts[kind]})
                            </span>
                            {visible[kind] && <span aria-hidden="true">✓</span>}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
