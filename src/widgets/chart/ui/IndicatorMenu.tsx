'use client';

/**
 * "보조지표" 메뉴 — 지표 레지스트리 바인딩에 따른 체크박스·기간 칩 UI.
 */

import { useTranslations } from 'next-intl';
import type { CSSProperties } from 'react';
import { useId, useRef } from 'react';
import { useEscapeKey } from '@/shared/hooks/useEscapeKey';
import { useFocusTrap } from '@/shared/hooks/useFocusTrap';
import { useOnClickOutside } from '@/shared/hooks/useOnClickOutside';
import { cn } from '@/shared/lib/cn';
import { getPeriodColor } from '@/shared/lib/chartColors';
import {
    groupBindingsByCategory,
    type IndicatorBinding,
} from '../model/indicatorRegistry';
import type { ChartMenuControl } from '../hooks/useExclusiveChartMenu';
import { ChartPopoverPanel } from './ChartPopoverPanel';
import {
    CHART_MENU_TRIGGER_LAYOUT,
    CHART_POPOVER_TRIGGER,
} from './chartPopoverStyles';
import { MenuTriggerText } from './MenuTriggerText';

interface IndicatorMenuProps {
    bindings: IndicatorBinding[];
    /** 헤더 띠 메뉴 셋이 공유하는 열림 제어(한 번에 하나만 열린다). */
    menu: ChartMenuControl;
}

interface IndicatorRowProps {
    binding: IndicatorBinding;
}

const ROW_CLASS =
    'flex items-center gap-2 rounded px-2 py-1.5 text-sm text-secondary-200';

function PeriodChips({ binding }: IndicatorRowProps) {
    const {
        availablePeriods = [],
        visiblePeriods = [],
        onTogglePeriod,
    } = binding;

    // 배열 includes를 map 안에서 반복하면 O(n*m) — Set으로 O(1) 조회.
    const visible = new Set(visiblePeriods);

    return (
        <div className="flex flex-wrap gap-1">
            {availablePeriods.map(period => {
                const selected = visible.has(period);
                return (
                    <button
                        key={period}
                        type="button"
                        onClick={() => onTogglePeriod?.(period)}
                        aria-pressed={selected}
                        className={cn(
                            'focus-visible:ring-primary-500 flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors focus-visible:ring-1 focus-visible:outline-none',
                            /* 선택 상태를 흰 글자로 표현하면 라이트 테마에서
                               secondary-700(거의 흰색) 위에 얹혀 사라진다.
                               두 테마에서 모두 최고 대비인 fg 토큰을 쓴다. */
                            selected
                                ? 'bg-secondary-700 text-secondary-50'
                                : 'text-secondary-400 hover:bg-secondary-700 hover:text-secondary-50'
                        )}
                    >
                        <span
                            className="h-2 w-2 shrink-0 rounded-full bg-[var(--chip-color)]"
                            style={
                                {
                                    '--chip-color': getPeriodColor(period),
                                } as CSSProperties
                            }
                        />
                        {period}
                    </button>
                );
            })}
        </div>
    );
}

function PeriodRow({ binding }: IndicatorRowProps) {
    return (
        <div className={ROW_CLASS}>
            <span
                className={cn(
                    'w-16 shrink-0 font-medium',
                    binding.active ? 'text-secondary-50' : 'text-secondary-400'
                )}
            >
                {binding.meta.label}
            </span>
            <PeriodChips binding={binding} />
        </div>
    );
}

function ToggleRow({ binding }: IndicatorRowProps) {
    return (
        <label className={cn(ROW_CLASS, 'cursor-pointer')}>
            <input
                type="checkbox"
                checked={binding.active}
                // onToggle은 타입상 optional이라 undefined면 controlled input이
                // read-only가 되고 React 경고가 난다. no-op으로 controlled 유지.
                onChange={() => binding.onToggle?.()}
                className="h-4 w-4 accent-primary-500"
            />
            <span>{binding.meta.label}</span>
        </label>
    );
}

/** 두 열 체크박스가 들어가는 폭(22rem). 뷰포트가 좁으면 `ChartPopoverPanel`이 줄인다. */
const POPOVER_WIDTH_PX = 352;

/**
 * "보조지표" 드롭다운 — 보조지표를 카테고리별로 켜고 끄는 **앵커드 팝오버**다. "차트 작도" 메뉴
 * (`ChartOverlayMenu`)와 같은 트리거 모양·같은 패널(`ChartPopoverPanel`: body 포털 + 뷰포트 clamp)·같은
 * 훅이라 트리거 바로 아래로 열린다. 열림 상태는 헤더 띠의 다른 메뉴와 함께 `useExclusiveChartMenu`가 쥔다.
 * 켜 놓은 채로 차트를 보며 고르는 설정이라 모달 배경도 필요 없다 — 바깥을 누르거나 Esc를 누르면 닫힌다.
 *
 * 폭(`POPOVER_WIDTH_PX`)은 "차트 작도" 패널보다 넓다 — 지표 체크박스를 두 열로 놓는다.
 * `role="group"`인 이유는 `ChartOverlayMenu`와 같다(순수 토글 모음이지 ARIA menu가 아니다).
 */
export function IndicatorMenu({ bindings, menu }: IndicatorMenuProps) {
    const t = useTranslations('widgets.chart');
    const tCategory = useTranslations('widgets.chart.indicatorCategory');
    const triggerRef = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    // 같은 페이지에 여러 차트가 렌더되어도 aria-controls id가 충돌하지 않도록 인스턴스별 고유 id를 쓴다.
    const panelId = useId();
    const { isOpen, toggle, close } = menu;
    useOnClickOutside([triggerRef, panelRef], close, { enabled: isOpen });
    useFocusTrap(panelRef, isOpen);
    useEscapeKey(close, isOpen);
    const groups = groupBindingsByCategory(bindings);
    // 켜진 **지표 수**다(MA·EMA는 기간이 하나라도 켜져 있으면 1개).
    const activeCount = bindings.filter(binding => binding.active).length;
    const baseLabel = t('IndicatorMenu.triggerEmpty');
    const countLabel =
        activeCount > 0
            ? t('IndicatorMenu.trigger', { v0: activeCount })
            : null;

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
                    label={t('IndicatorMenu.panelLabel')}
                    width={POPOVER_WIDTH_PX}
                    className="gap-3 p-3"
                >
                    {groups.map(group => (
                        <section key={group.category}>
                            <h3 className="mb-1 text-xs font-semibold text-secondary-500">
                                {tCategory(group.labelKey)}
                            </h3>
                            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                                {group.items.map(binding =>
                                    binding.meta.hasPeriods ? (
                                        <div
                                            key={binding.meta.key}
                                            className="col-span-2"
                                        >
                                            <PeriodRow binding={binding} />
                                        </div>
                                    ) : (
                                        <ToggleRow
                                            key={binding.meta.key}
                                            binding={binding}
                                        />
                                    )
                                )}
                            </div>
                        </section>
                    ))}
                </ChartPopoverPanel>
            )}
        </div>
    );
}
