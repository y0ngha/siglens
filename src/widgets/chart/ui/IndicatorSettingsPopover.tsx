'use client';

import { useTranslations } from 'next-intl';
import type { CSSProperties } from 'react';
import { useId, useRef } from 'react';
import { useEscapeKey } from '@/shared/hooks/useEscapeKey';
import { useFocusTrap } from '@/shared/hooks/useFocusTrap';
import { usePopoverToggle } from '@/shared/hooks/usePopoverToggle';
import { cn } from '@/shared/lib/cn';
import { getPeriodColor } from '@/shared/lib/chartColors';
import { GearIcon } from '@/shared/ui/GearIcon';
import {
    groupBindingsByCategory,
    type IndicatorBinding,
} from '../model/indicatorRegistry';
import { ChartPopoverPanel } from './ChartPopoverPanel';
import { CHART_POPOVER_TRIGGER } from './chartPopoverStyles';

interface IndicatorSettingsPopoverProps {
    bindings: IndicatorBinding[];
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

/**
 * 톱니바퀴 "보조지표 설정" — 보조지표를 카테고리별로 켜고 끄는 **앵커드 팝오버**다. "차트 작도" 메뉴
 * (`ChartOverlayMenu`)와 같은 패널(`ChartPopoverPanel`: body 포털 + 뷰포트 clamp)·같은 훅(`usePopoverToggle` +
 * `useFocusTrap` + `useEscapeKey`)이라 트리거 바로 아래로 열린다. 예전에는 화면 중앙 네이티브 `<dialog>` 모달이라
 * 차트 한가운데를 가리고 헤더 띠의 다른 메뉴와 동작이 달랐다(사용자 제보). 켜 놓은 채로 차트를 보며 고르는
 * 설정이라 모달 배경도 필요 없다 — 바깥을 누르거나 Esc를 누르면 닫힌다.
 *
 * 폭(`POPOVER_WIDTH_PX`)은 "차트 작도" 패널보다 넓다 — 지표 체크박스를 두 열로 놓는다. 가격 축 오프셋(`axisInset`)은
 * 쓰지 않는다: 그 오프셋은 작도 항목 hover로 뜨는 가격 축 라벨을 비키려는 값이고, 지표 설정에는 그런 라벨이 없다.
 * `role="group"`인 이유는 `ChartOverlayMenu`와 같다(순수 토글 모음이지 ARIA menu가 아니다).
 */
/** 두 열 체크박스가 들어가는 폭(22rem). 뷰포트가 좁으면 `ChartPopoverPanel`이 줄인다. */
const POPOVER_WIDTH_PX = 352;

export function IndicatorSettingsPopover({
    bindings,
}: IndicatorSettingsPopoverProps) {
    const t = useTranslations('widgets.chart');
    const tCategory = useTranslations('widgets.chart.indicatorCategory');
    const triggerRef = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    // 같은 페이지에 여러 차트가 렌더되어도 aria-controls id가 충돌하지 않도록 인스턴스별 고유 id를 쓴다.
    const panelId = useId();
    const { isOpen, toggle, close } = usePopoverToggle([triggerRef, panelRef]);
    useFocusTrap(panelRef, isOpen);
    useEscapeKey(close, isOpen);
    const groups = groupBindingsByCategory(bindings);

    return (
        <div className="relative">
            {/* 보이는 크기는 32px 헤더 스트립에 맞춘 h-7 w-7을 유지하고,
                ::before로 히트 영역만 44x44 터치 타겟까지 확장한다
                (28 + 2*8 = 44px). */}
            <button
                ref={triggerRef}
                type="button"
                onClick={toggle}
                aria-label={t('IndicatorSettingsPopover.c6e1ca')}
                aria-expanded={isOpen}
                aria-controls={panelId}
                className={cn(CHART_POPOVER_TRIGGER, 'w-7 justify-center')}
            >
                <GearIcon className="h-4 w-4" />
            </button>

            {isOpen && (
                <ChartPopoverPanel
                    triggerRef={triggerRef}
                    panelRef={panelRef}
                    id={panelId}
                    label={t('IndicatorSettingsPopover.c6e1ca')}
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
