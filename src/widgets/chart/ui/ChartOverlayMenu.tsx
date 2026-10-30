'use client';

/**
 * "차트 작도" 메뉴 — 작도 항목별 표시 토글과 레벨 연장 설정 UI.
 */

import { useTranslations } from 'next-intl';
import type { CSSProperties } from 'react';
import { useEffect, useId, useRef } from 'react';
import type { OverlayKind } from '@y0ngha/siglens-core';
import { useEscapeKey } from '@/shared/hooks/useEscapeKey';
import { useFocusTrap } from '@/shared/hooks/useFocusTrap';
import { useOnClickOutside } from '@/shared/hooks/useOnClickOutside';
import { cn } from '@/shared/lib/cn';
import type { ToggleSetting } from '../types';
import type { ChartMenuControl } from '../hooks/useExclusiveChartMenu';
import {
    CheckBox,
    type CheckState,
    MENU_ROW_CLASS,
    SettingRow,
} from './ChartMenuRow';
import { ChartPopoverPanel } from './ChartPopoverPanel';
import {
    CHART_MENU_TRIGGER_LAYOUT,
    CHART_POPOVER_TRIGGER,
} from './chartPopoverStyles';
import { MenuTriggerText } from './MenuTriggerText';
import type {
    OverlayMenuGroupKind,
    OverlayMenuItem,
} from '../utils/overlayItems';

interface ChartOverlayMenuProps {
    /** 헤더 띠 메뉴 셋이 공유하는 열림 제어(한 번에 하나만 열린다). */
    menu: ChartMenuControl;
    /** 켜고 끌 수 있는 항목 — `buildOverlayMenuItems`가 실제로 그려지는 작도만 담는다. */
    items: readonly OverlayMenuItem[];
    hiddenKeys: ReadonlySet<string>;
    onSetVisible: (keys: readonly string[], visible: boolean) => void;
    /**
     * 수평 레벨 오른쪽 연장 설정 — 작도선의 표시 옵션이라 "차트 작도" 메뉴에 둔다(트리거 개수에는 세지 않는다).
     * 연장할 레벨이 없으면 넘기지 않아 행을 숨긴다. 작도 항목이 없어도 이 행 때문에 메뉴가 뜬다.
     */
    rightExtend?: ToggleSetting;
    /** 항목 key → 차트에 그린 색. 있으면 항목 앞에 색 점을 찍어 선과 짝짓는다. */
    itemColors?: ReadonlyMap<string, string>;
    /** 항목 hover·focus로 그 작도를 강조한다(축 라벨이 가려질 때 고르는 수단). */
    onHighlight?: (key: string | null) => void;
}

const NO_ITEM_COLORS: ReadonlyMap<string, string> = new Map();

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
/** 패널 폭(px) — `ChartPopoverPanel`이 뷰포트 안으로 clamp해 좁은 화면에서도 잘리지 않는다. */
const PANEL_WIDTH_PX = 240;

/**
 * "차트 작도" 드롭다운 — 매매 가격선과 AI가 참조한 로직 작도(패턴·추세선·
 * 다이버전스·피보나치·엘리어트 파동)를 **항목 단위로** 켜고 끈다. AI 패널 카드의
 * "차트에서 보기"와 같은 상태(`useOverlayItemVisibility`)를 쓴다.
 *
 * 그룹 헤더("차트 패턴 2")는 그룹 전체 스위치다. 일부만 켜져 있으면 체크박스가 "–"이고
 * `aria-pressed="mixed"`로 알린다. 누르면 전부 켠다(전부 켜져 있을 때만 전부 끈다).
 *
 * `role="menu"`/`menuitemcheckbox`가 아니라 **레이블된 토글 그룹**이다 — ARIA
 * menu 패턴은 방향키 내비게이션·roving tabindex를 요구하는데(WAI-ARIA APG),
 * 여기 항목은 하나의 값(불리언)을 고르는 순수 토글일 뿐 메뉴가 열어야 할
 * "명령 목록"이 아니다. `role="group"` + `aria-label` 컨테이너 안에 평범한
 * `<button aria-pressed>`를 두어, 스크린 리더가 각 항목을 독립된 토글 버튼으로
 * 읽고 Tab으로 순서대로 오갈 수 있게 한다. 앵커드 패널은 `useOnClickOutside` +
 * `useFocusTrap` + `useEscapeKey`로 직접 그린다(`AnalysisSettingsMenu`와 동일) —
 * `PopoverSurface`는 패널에 `role="dialog"`를 강제해 이 그룹 시맨틱과 맞지 않는다.
 */
export function ChartOverlayMenu({
    menu,
    items,
    hiddenKeys,
    onSetVisible,
    rightExtend,
    itemColors = NO_ITEM_COLORS,
    onHighlight,
}: ChartOverlayMenuProps) {
    const t = useTranslations('widgets.chart');
    const triggerRef = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const panelId = useId();
    const { isOpen, toggle, close } = menu;

    useOnClickOutside([triggerRef, panelRef], close, { enabled: isOpen });

    useFocusTrap(panelRef, isOpen);
    useEscapeKey(close, isOpen);

    // 메뉴가 건 강조는 패널이 닫히면 푼다 — 커서가 항목 위에 있는 채로 닫히면
    // mouseleave가 오지 않아 강조가 남는다. 카드가 건 강조는 건드리지 않는다.
    // hover와 focus는 메뉴가 쥔 강조 하나를 공유한다 — 마지막 enter/leave 이벤트가 이긴다(의도).
    const highlightedByMenu = useRef(false);
    const highlight = (key: string): void => {
        highlightedByMenu.current = true;
        onHighlight?.(key);
    };
    // 메뉴가 건 강조만 푼다 — hover·focus 없이 카드가 건 강조는 그대로 둔다.
    const unhighlight = (): void => {
        if (!highlightedByMenu.current) return;
        highlightedByMenu.current = false;
        onHighlight?.(null);
    };
    useEffect(() => {
        if (isOpen || !highlightedByMenu.current) return;
        highlightedByMenu.current = false;
        onHighlight?.(null);
    }, [isOpen, onHighlight]);

    if (items.length === 0 && rightExtend === undefined) return null;

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
        // 카드 없는 종류 항목은 그룹 이름(피보나치·다이버전스·엘리어트 파동)으로.
        return item.label ?? t(KIND_LABEL_KEY[item.kind]);
    };

    // 작도 항목이 없고 "오른쪽 연장" 행만 있을 때는 "차트 작도 0"이 거짓 안내라 개수를 뺀 고정 이름을 쓴다.
    const baseLabel = t('ChartOverlayMenu.5d0ffc');
    const countLabel =
        items.length === 0
            ? null
            : t('ChartOverlayMenu.4b1cdc', { v0: activeCount });

    return (
        <div className="relative">
            <button
                ref={triggerRef}
                type="button"
                onClick={toggle}
                aria-label={countLabel ?? baseLabel}
                aria-expanded={isOpen}
                aria-controls={panelId}
                className={cn(CHART_POPOVER_TRIGGER, CHART_MENU_TRIGGER_LAYOUT)}
            >
                <MenuTriggerText base={baseLabel} withCount={countLabel} />
            </button>

            {isOpen && (
                <ChartPopoverPanel
                    triggerRef={triggerRef}
                    panelRef={panelRef}
                    id={panelId}
                    // 개수 없는 고정 이름 — 항목을 켤 때마다 그룹 이름이 바뀌어 읽히지 않게 한다.
                    label={t('ChartOverlayMenu.5d0ffc')}
                    width={PANEL_WIDTH_PX}
                >
                    {groups.map((group, index) => {
                        const keys = group.items.map(item => item.key);
                        // 그룹 사이 구분선 — 첫 그룹 위에는 긋지 않는다.
                        const divider =
                            index > 0
                                ? 'mt-1 border-t border-secondary-700/60 pt-1'
                                : '';
                        if (group.kind === 'action') {
                            const [item] = group.items;
                            if (item === undefined) return null;
                            const on = isOn(item.key);
                            return (
                                <div key={group.kind} className={divider}>
                                    <button
                                        type="button"
                                        aria-pressed={on}
                                        onClick={() => onSetVisible(keys, !on)}
                                        className={cn(
                                            MENU_ROW_CLASS,
                                            on
                                                ? 'text-secondary-100'
                                                : 'text-secondary-400'
                                        )}
                                    >
                                        <CheckBox state={on} />
                                        <span>{itemLabel(item)}</span>
                                    </button>
                                </div>
                            );
                        }
                        const onCount = keys.filter(isOn).length;
                        const allOn = onCount === keys.length;
                        const pressed: CheckState = allOn
                            ? true
                            : onCount === 0
                              ? false
                              : 'mixed';
                        return (
                            <div
                                key={group.kind}
                                className={cn('flex flex-col', divider)}
                            >
                                {/* 그룹 헤더 — 섹션 제목처럼 작게, 그러나 그룹 전체 스위치다.
                                    일부만 켜졌으면 체크박스가 "–"(aria-pressed="mixed")다. */}
                                <button
                                    type="button"
                                    aria-pressed={pressed}
                                    onClick={() => onSetVisible(keys, !allOn)}
                                    className={cn(
                                        MENU_ROW_CLASS,
                                        'text-[11px] font-semibold text-secondary-400'
                                    )}
                                >
                                    <CheckBox state={pressed} />
                                    <span>
                                        {t(KIND_LABEL_KEY[group.kind])}
                                        <span className="ml-1 font-normal text-secondary-500">
                                            {keys.length}
                                        </span>
                                    </span>
                                </button>
                                {group.items.map(item => {
                                    const on = isOn(item.key);
                                    const color = itemColors.get(item.key);
                                    return (
                                        <button
                                            key={item.key}
                                            type="button"
                                            aria-pressed={on}
                                            onClick={() =>
                                                onSetVisible([item.key], !on)
                                            }
                                            onMouseEnter={() =>
                                                highlight(item.key)
                                            }
                                            onMouseLeave={unhighlight}
                                            onFocus={() => highlight(item.key)}
                                            onBlur={unhighlight}
                                            className={cn(
                                                MENU_ROW_CLASS,
                                                'pl-4',
                                                on
                                                    ? 'text-secondary-100'
                                                    : 'text-secondary-400'
                                            )}
                                        >
                                            <CheckBox state={on} />
                                            {color !== undefined && (
                                                <span
                                                    aria-hidden="true"
                                                    className="size-2 shrink-0 rounded-full bg-[var(--item-color)]"
                                                    style={
                                                        {
                                                            '--item-color':
                                                                color,
                                                        } as CSSProperties
                                                    }
                                                />
                                            )}
                                            <span className="min-w-0 truncate">
                                                {itemLabel(item)}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        );
                    })}
                    {rightExtend && (
                        <div
                            className={cn(
                                'flex flex-col',
                                groups.length > 0 &&
                                    'mt-1 border-t border-secondary-700/60 pt-1'
                            )}
                        >
                            <SettingRow
                                checked={rightExtend.checked}
                                onChange={rightExtend.onChange}
                                label={t('ChartOverlayMenu.a57483')}
                            />
                        </div>
                    )}
                </ChartPopoverPanel>
            )}
        </div>
    );
}
