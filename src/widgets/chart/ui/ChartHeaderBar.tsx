'use client';

/**
 * 가격 차트 위 헤더 띠 — 왼쪽 슬롯(시간외 시세 한 줄)과 메뉴 셋(보조지표·차트 작도·차트 설정).
 *
 * 메뉴는 캔버스 밖 헤더 띠에 둔다(터미널 탭바의 `+` 자리). 캔버스 위에 얹었을 때는 드래그·줌
 * 중에 캔들을 가렸고 가격 눈금·범례와 자리를 다퉜다. 메뉴 셋은 한 번에 하나만 열린다.
 */
import type { ReactNode } from 'react';
import { useExclusiveChartMenu } from '../hooks/useExclusiveChartMenu';
import type { IndicatorBinding } from '../model/indicatorRegistry';
import type { ToggleSetting } from '../types';
import type { OverlayMenuItem } from '../utils/overlayItems';
import { ChartOverlayMenu } from './ChartOverlayMenu';
import { ChartSettingsMenu } from './ChartSettingsMenu';
import { IndicatorMenu } from './IndicatorMenu';

const OVERLAYS_UNAVAILABLE = new Set(['overlays'] as const);
const ALL_AVAILABLE = new Set<never>();

interface ChartHeaderBarProps {
    /** 메뉴 셋 앞의 `flex-1 min-w-0` 칸 — 폭이 모자라면 이 슬롯이 먼저 줄어든다. */
    startSlot?: ReactNode;
    indicatorBindings: IndicatorBinding[];
    overlayItems: readonly OverlayMenuItem[];
    hiddenOverlayKeys: ReadonlySet<string>;
    onSetOverlayVisible: (keys: readonly string[], visible: boolean) => void;
    overlayItemColors: ReadonlyMap<string, string>;
    onHighlightOverlay?: (key: string | null) => void;
    /** 수평 레벨 오른쪽 연장 설정 — 연장할 레벨이 없으면 생략한다. */
    levelRightExtend?: ToggleSetting;
    extendedHours?: ToggleSetting;
}

/**
 * 헤더 띠를 그리고 메뉴 셋의 배타적 열림 상태를 소유한다. 봉이 없을 때는 띠 자체가 렌더되지
 * 않으므로(`StockChart`) 그동안 열려 있던 메뉴는 닫힌 상태로 돌아온다 — 빈 차트 위에 메뉴가
 * 떠 있지 않게 하는 의도된 동작이다.
 */
export function ChartHeaderBar({
    startSlot,
    indicatorBindings,
    overlayItems,
    hiddenOverlayKeys,
    onSetOverlayVisible,
    overlayItemColors,
    onHighlightOverlay,
    levelRightExtend,
    extendedHours,
}: ChartHeaderBarProps) {
    // "차트 작도" 메뉴는 항목도 연장 설정도 없으면 렌더되지 않는다 — 열려 있던 상태를 닫아 둬야
    // 항목이 다시 생길 때 사용자가 누르지 않은 팝오버가 열리지 않는다(`useExclusiveChartMenu`).
    const hasOverlayMenu =
        overlayItems.length > 0 || levelRightExtend !== undefined;
    const chartMenus = useExclusiveChartMenu(
        hasOverlayMenu ? ALL_AVAILABLE : OVERLAYS_UNAVAILABLE
    );

    return (
        <div className="flex h-8 shrink-0 items-center gap-0.5 border-b border-secondary-700 px-1 sm:gap-1">
            {/* 컨테이너 쿼리 기준 — 슬롯 폭이 9rem 아래면 시세 캡션이 통째로 숨는다(`ExtendedHoursQuoteLine`). */}
            <div className="@container flex min-w-0 flex-1 items-center pl-1">
                {startSlot}
            </div>
            <IndicatorMenu
                bindings={indicatorBindings}
                menu={chartMenus.bind('indicators')}
            />
            <ChartOverlayMenu
                menu={chartMenus.bind('overlays')}
                items={overlayItems}
                hiddenKeys={hiddenOverlayKeys}
                onSetVisible={onSetOverlayVisible}
                itemColors={overlayItemColors}
                onHighlight={onHighlightOverlay}
                rightExtend={levelRightExtend}
            />
            <ChartSettingsMenu
                menu={chartMenus.bind('settings')}
                extendedHours={extendedHours}
            />
        </div>
    );
}
