'use client';

import { useTranslations } from 'next-intl';
import { useId, useRef } from 'react';
import type { OverlayKind } from '@y0ngha/siglens-core';
import { useEscapeKey } from '@/shared/hooks/useEscapeKey';
import { useFocusTrap } from '@/shared/hooks/useFocusTrap';
import { usePopoverToggle } from '@/shared/hooks/usePopoverToggle';
import { cn } from '@/shared/lib/cn';
import type {
    OverlayMenuGroupKind,
    OverlayMenuItem,
} from '../utils/overlayItems';

interface ChartOverlayMenuProps {
    /** 켜고 끌 수 있는 항목 — `buildOverlayMenuItems`가 실제로 그려지는 작도만 담는다. */
    items: readonly OverlayMenuItem[];
    hiddenKeys: ReadonlySet<string>;
    onSetVisible: (keys: readonly string[], visible: boolean) => void;
}

const KIND_LABEL_KEY: Record<OverlayKind, string> = {
    pattern: 'ChartOverlayMenu.bdeea2',
    trendline: 'ChartOverlayMenu.0b5eb6',
    divergence: 'ChartOverlayMenu.67eb73',
    fibonacci: 'ChartOverlayMenu.2bac73',
    elliott: 'ChartOverlayMenu.3b6851',
};

/**
 * 메뉴 그룹 순서 — 매매 가격선이 맨 위(가장 자주 끄는 선), 그다음 core `OverlayKind`.
 * `Record`에서 키를 뽑는 이유: core에 새 `OverlayKind`가 생기면 여기서 컴파일 에러가
 * 나 메뉴에서 조용히 빠지는 일이 없다.
 */
const GROUP_ORDER = Object.keys({
    action: true,
    pattern: true,
    trendline: true,
    divergence: true,
    fibonacci: true,
    elliott: true,
} satisfies Record<OverlayMenuGroupKind, true>) as OverlayMenuGroupKind[];
// `min-h-11` — 스크롤되는 메뉴의 행은 44px 터치 타깃을 지킨다(`ModelListbox` 행과 같은 규약).
// 인접한 그룹 헤더·항목을 모바일에서 잘못 누르지 않게 한다.
const TOGGLE_ROW_CLASS =
    'flex min-h-11 w-full touch-manipulation items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:outline-none';

function toggleRowTone(on: boolean): string {
    return on
        ? 'bg-secondary-700 text-secondary-50'
        : 'text-secondary-400 hover:bg-secondary-700 hover:text-secondary-50';
}

/**
 * "차트 작도" 드롭다운 — 매매 가격선과 AI가 참조한 로직 작도(패턴·추세선·
 * 다이버전스·피보나치·엘리어트 파동)를 **항목 단위로** 켜고 끈다. AI 패널 카드의
 * "차트에서 보기"와 같은 상태(`useOverlayItemVisibility`)를 쓴다.
 *
 * 그룹 헤더("차트 패턴 (2)")는 그룹 전체 스위치다. 일부만 켜져 있으면
 * `aria-pressed="mixed"`로 알리고, 누르면 전부 켠다(전부 켜져 있을 때만 전부 끈다).
 *
 * `role="menu"`/`menuitemcheckbox`가 아니라 **레이블된 토글 그룹**이다 — ARIA
 * menu 패턴은 방향키 내비게이션·roving tabindex를 요구하는데(WAI-ARIA APG),
 * 여기 항목은 하나의 값(불리언)을 고르는 순수 토글일 뿐 메뉴가 열어야 할
 * "명령 목록"이 아니다. `role="group"` + `aria-label` 컨테이너 안에 평범한
 * `<button aria-pressed>`를 두어, 스크린 리더가 각 항목을 독립된 토글 버튼으로
 * 읽고 Tab으로 순서대로 오갈 수 있게 한다. 앵커드 패널은 `usePopoverToggle` +
 * `useFocusTrap` + `useEscapeKey`로 직접 그린다(`AnalysisSettingsMenu`와 동일) —
 * `PopoverSurface`는 패널에 `role="dialog"`를 강제해 이 그룹 시맨틱과 맞지 않는다.
 */
export function ChartOverlayMenu({
    items,
    hiddenKeys,
    onSetVisible,
}: ChartOverlayMenuProps) {
    const t = useTranslations('widgets.chart');
    const triggerRef = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const panelId = useId();
    const { isOpen, toggle, close } = usePopoverToggle([triggerRef, panelRef]);

    useFocusTrap(panelRef, isOpen);
    useEscapeKey(close, isOpen);

    if (items.length === 0) return null;

    const isOn = (key: string): boolean => !hiddenKeys.has(key);
    // 켜진 **항목 수**다(카테고리 수가 아니다).
    const activeCount = items.filter(item => isOn(item.key)).length;
    const groups = GROUP_ORDER.map(kind => ({
        kind,
        items: items.filter(item => item.kind === kind),
    })).filter(group => group.items.length > 0);

    const itemLabel = (item: OverlayMenuItem): string => {
        if (item.kind === 'action') return t('ChartOverlayMenu.07d45b');
        if (item.kind === 'trendline') {
            return item.direction === 'up'
                ? t('ChartOverlayMenu.bfe4b6', { v0: item.index })
                : t('ChartOverlayMenu.ac1149', { v0: item.index });
        }
        return item.label;
    };

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
                    // 개수 없는 고정 이름 — 항목을 켤 때마다 그룹 이름이 바뀌어 읽히지 않게 한다.
                    aria-label={t('ChartOverlayMenu.5d0ffc')}
                    tabIndex={-1}
                    className={cn(
                        'absolute top-full right-0 z-50 mt-1 max-h-[min(70vh,28rem)] w-60 max-w-[calc(100vw-1rem)] overflow-y-auto',
                        'flex flex-col gap-0.5 rounded-lg border border-secondary-700 bg-secondary-900 p-1.5 shadow-2xl outline-none'
                    )}
                >
                    {groups.map(group => {
                        const keys = group.items.map(item => item.key);
                        if (group.kind === 'action') {
                            const [item] = group.items;
                            if (item === undefined) return null;
                            const on = isOn(item.key);
                            return (
                                <button
                                    key={group.kind}
                                    type="button"
                                    aria-pressed={on}
                                    onClick={() => onSetVisible(keys, !on)}
                                    className={cn(
                                        TOGGLE_ROW_CLASS,
                                        'font-medium',
                                        toggleRowTone(on)
                                    )}
                                >
                                    <span>{itemLabel(item)}</span>
                                    {on && <span aria-hidden="true">✓</span>}
                                </button>
                            );
                        }
                        const onCount = keys.filter(isOn).length;
                        const allOn = onCount === keys.length;
                        const pressed = allOn
                            ? true
                            : onCount === 0
                              ? false
                              : 'mixed';
                        return (
                            <div
                                key={group.kind}
                                className="flex flex-col gap-0.5"
                            >
                                <button
                                    type="button"
                                    aria-pressed={pressed}
                                    onClick={() => onSetVisible(keys, !allOn)}
                                    className={cn(
                                        TOGGLE_ROW_CLASS,
                                        'font-medium',
                                        toggleRowTone(onCount > 0)
                                    )}
                                >
                                    <span>
                                        {t(KIND_LABEL_KEY[group.kind])} (
                                        {keys.length})
                                    </span>
                                    {pressed === 'mixed' ? (
                                        <span className="text-[10px] text-secondary-400">
                                            {t('ChartOverlayMenu.c178bc')}
                                        </span>
                                    ) : (
                                        allOn && (
                                            <span aria-hidden="true">✓</span>
                                        )
                                    )}
                                </button>
                                {group.items.map(item => {
                                    const on = isOn(item.key);
                                    return (
                                        <button
                                            key={item.key}
                                            type="button"
                                            aria-pressed={on}
                                            onClick={() =>
                                                onSetVisible([item.key], !on)
                                            }
                                            className={cn(
                                                TOGGLE_ROW_CLASS,
                                                'pl-5',
                                                toggleRowTone(on)
                                            )}
                                        >
                                            <span className="min-w-0 truncate">
                                                {itemLabel(item)}
                                            </span>
                                            {on && (
                                                <span aria-hidden="true">
                                                    ✓
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
