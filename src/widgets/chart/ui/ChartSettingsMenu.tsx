'use client';

import { useTranslations } from 'next-intl';
import { useId, useRef } from 'react';
import { useEscapeKey } from '@/shared/hooks/useEscapeKey';
import { useFocusTrap } from '@/shared/hooks/useFocusTrap';
import { useOnClickOutside } from '@/shared/hooks/useOnClickOutside';
import { cn } from '@/shared/lib/cn';
import { GearIcon } from '@/shared/ui/GearIcon';
import type { ChartMenuControl } from '../hooks/useExclusiveChartMenu';
import type { ToggleSetting } from '../types';
import { CheckBox, MENU_ROW_CLASS, SettingRow } from './ChartMenuRow';
import { ChartPopoverPanel } from './ChartPopoverPanel';
import { CHART_POPOVER_TRIGGER } from './chartPopoverStyles';

interface ChartSettingsMenuProps {
    /** 헤더 띠 메뉴 셋이 공유하는 열림 제어(한 번에 하나만 열린다). */
    menu: ChartMenuControl;
    /**
     * 프리·애프터마켓(시간외) 봉·음영 표시 설정 — 미국 주식 인트라데이에서만 넘긴다. 넘기지 않으면(1일봉·한국
     * 종목·코인 등) 행을 숨기지 않고 사유와 함께 비활성으로 보여 준다.
     */
    extendedHours?: ToggleSetting;
}

const PANEL_WIDTH_PX = 256;

/**
 * 톱니바퀴 "차트 설정" — 차트 표시 환경설정을 모은 앵커드 팝오버다(첫 항목: 시간외 거래 표시). 작도선을 켜고
 * 끄는 "차트 작도"(`ChartOverlayMenu`)·보조지표를 고르는 "보조지표"(`IndicatorMenu`)와 같은 패널·훅을 쓰고,
 * 열림 상태는 `useExclusiveChartMenu`가 함께 쥔다.
 *
 * 시간외 거래가 적용되지 않는 차트에서도 톱니바퀴와 행을 숨기지 않는다 — 설정이 왜 없는지 모르는 채 찾게 만들지
 * 않기 위해서다. 비활성 행은 `disabled`가 아니라 `aria-disabled`라 포커스를 받아 스크린 리더가 사유
 * (`aria-describedby`)를 읽는다. `role="group"`인 이유는 `ChartOverlayMenu`와 같다.
 */
export function ChartSettingsMenu({
    menu,
    extendedHours,
}: ChartSettingsMenuProps) {
    const t = useTranslations('widgets.chart');
    const triggerRef = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const panelId = useId();
    const reasonId = useId();
    const { isOpen, toggle, close } = menu;

    useOnClickOutside([triggerRef, panelRef], close, { enabled: isOpen });
    useFocusTrap(panelRef, isOpen);
    useEscapeKey(close, isOpen);

    const label = t('ChartSettingsMenu.label');

    return (
        <div className="relative">
            {/* 보이는 크기는 32px 헤더 스트립에 맞춘 h-7 w-7을 유지하고,
                ::before로 히트 영역은 세로만 44px까지 넓힌다(가로는 이웃 트리거를 가로채지 않게 2px만 —
                `chartPopoverStyles.ts`의 `CHART_POPOVER_TRIGGER` 참고). */}
            <button
                ref={triggerRef}
                type="button"
                onClick={toggle}
                aria-label={label}
                title={label}
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
                    label={label}
                    width={PANEL_WIDTH_PX}
                >
                    {extendedHours !== undefined ? (
                        <SettingRow
                            checked={extendedHours.checked}
                            onChange={extendedHours.onChange}
                            label={t('ChartSettingsMenu.extendedHours')}
                        />
                    ) : (
                        <>
                            <button
                                type="button"
                                aria-disabled="true"
                                aria-describedby={reasonId}
                                className={cn(
                                    MENU_ROW_CLASS,
                                    'cursor-not-allowed text-secondary-500 hover:bg-transparent'
                                )}
                            >
                                <CheckBox state={false} />
                                <span>
                                    {t('ChartSettingsMenu.extendedHours')}
                                </span>
                            </button>
                            <p
                                id={reasonId}
                                className="px-2 pb-1 pl-[34px] text-[11px] text-secondary-500"
                            >
                                {t(
                                    'ChartSettingsMenu.extendedHoursUnavailable'
                                )}
                            </p>
                        </>
                    )}
                </ChartPopoverPanel>
            )}
        </div>
    );
}
