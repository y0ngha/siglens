'use client';

import { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';
import { getPeriodColor } from '@/domain/constants/colors';
import { useOnClickOutside } from '@/components/chart/hooks/useOnClickOutside';

interface IndicatorToggleGroup {
    visible: boolean;
    onToggle: () => void;
}

type IndicatorType = 'ma' | 'ema';

type DropdownType = IndicatorType | null;

const DROPDOWN_OFFSET_PX = 4;

const indicatorButtonClass = (active: boolean): string =>
    cn(
        'rounded px-2 py-1 text-xs font-medium transition-colors',
        active
            ? 'bg-secondary-700 text-white'
            : 'bg-secondary-800/80 text-secondary-400 hover:bg-secondary-700 hover:text-white'
    );

interface DropdownIndicatorConfig {
    type: IndicatorType;
    label: string;
    active: boolean;
    availablePeriods: readonly number[];
    visiblePeriods: number[];
    onToggle: (period: number) => void;
}

interface ToggleIndicatorConfig {
    label: string;
    visible: boolean;
    onToggle: () => void;
}

interface DropdownPosition {
    top: number;
    left: number;
}

interface PeriodLabelProps {
    indicatorName: string;
    visiblePeriods: number[];
}

function PeriodLabels({ indicatorName, visiblePeriods }: PeriodLabelProps) {
    if (visiblePeriods.length === 0) return null;

    return (
        <div className="flex flex-wrap gap-1">
            {visiblePeriods.map(period => (
                <span
                    key={period}
                    className="text-secondary-300 flex items-center gap-1 text-xs"
                >
                    {/* getPeriodColor는 런타임에 결정되는 동적 도메인 색상 상수(CHART_COLORS)를 반환하므로 style prop 사용 허용 */}
                    <span
                        className="inline-block h-1.5 w-3 shrink-0 rounded-sm"
                        style={{ backgroundColor: getPeriodColor(period) }}
                    />
                    {indicatorName}({period})
                </span>
            ))}
        </div>
    );
}

interface DropdownPortalProps {
    position: DropdownPosition;
    indicator: DropdownIndicatorConfig;
    portalRef: React.RefObject<HTMLDivElement | null>;
}

function DropdownPortal({
    position,
    indicator,
    portalRef,
}: DropdownPortalProps) {
    return createPortal(
        <div
            ref={portalRef}
            className="border-secondary-700 bg-secondary-800 fixed z-50 flex flex-col gap-0.5 rounded border p-1 shadow-lg"
            style={{ top: position.top, left: position.left }}
        >
            {indicator.availablePeriods.map(period => (
                <button
                    key={period}
                    type="button"
                    onClick={() => indicator.onToggle(period)}
                    className={cn(
                        'flex items-center gap-2 rounded px-2 py-1 text-xs transition-colors',
                        indicator.visiblePeriods.includes(period)
                            ? 'bg-secondary-700 text-white'
                            : 'text-secondary-400 hover:bg-secondary-700 hover:text-white'
                    )}
                >
                    {/* getPeriodColor는 런타임에 결정되는 동적 도메인 색상 상수(CHART_COLORS)를 반환하므로 style prop 사용 허용 */}
                    <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{
                            backgroundColor: getPeriodColor(period),
                        }}
                    />
                    {period}
                </button>
            ))}
        </div>,
        document.body
    );
}

interface IndicatorToolbarProps {
    maVisiblePeriods: number[];
    maAvailablePeriods: readonly number[];
    onMAToggle: (period: number) => void;
    emaVisiblePeriods: number[];
    emaAvailablePeriods: readonly number[];
    onEMAToggle: (period: number) => void;
    bollinger: IndicatorToggleGroup;
    macd: IndicatorToggleGroup;
    rsi: IndicatorToggleGroup;
    dmi: IndicatorToggleGroup;
    stochastic: IndicatorToggleGroup;
    stochRsi: IndicatorToggleGroup;
    cci: IndicatorToggleGroup;
    volumeProfile: IndicatorToggleGroup;
    ichimoku: IndicatorToggleGroup;
    candlePatterns?: IndicatorToggleGroup;
}

export function IndicatorToolbar({
    maVisiblePeriods,
    maAvailablePeriods,
    onMAToggle,
    emaVisiblePeriods,
    emaAvailablePeriods,
    onEMAToggle,
    bollinger,
    macd,
    rsi,
    dmi,
    stochastic,
    stochRsi,
    cci,
    volumeProfile,
    ichimoku,
    candlePatterns,
}: IndicatorToolbarProps) {
    const [openDropdown, setOpenDropdown] = useState<DropdownType>(null);
    const [dropdownPosition, setDropdownPosition] =
        useState<DropdownPosition | null>(null);

    const toolbarRef = useRef<HTMLDivElement>(null);
    const maButtonRef = useRef<HTMLButtonElement>(null);
    const emaButtonRef = useRef<HTMLButtonElement>(null);
    const portalRef = useRef<HTMLDivElement>(null);

    const buttonRefMap = useMemo(
        () => ({
            ma: maButtonRef,
            ema: emaButtonRef,
        }),
        []
    );

    useOnClickOutside(toolbarRef, event => {
        if (!openDropdown) return;
        const isInsidePortal = portalRef.current?.contains(
            event.target as Node
        );
        if (!isInsidePortal) {
            setOpenDropdown(null);
        }
    });

    const toggleDropdown = (type: IndicatorType): void => {
        if (openDropdown === type) {
            setOpenDropdown(null);
            return;
        }

        const buttonRef = buttonRefMap[type];
        if (!buttonRef.current) return;

        const rect = buttonRef.current.getBoundingClientRect();
        setDropdownPosition({
            top: rect.bottom + window.scrollY + DROPDOWN_OFFSET_PX,
            left: rect.left + window.scrollX,
        });
        setOpenDropdown(type);
    };

    const dropdownIndicators: DropdownIndicatorConfig[] = [
        {
            type: 'ma',
            label: 'MA',
            active: maVisiblePeriods.length > 0,
            availablePeriods: maAvailablePeriods,
            visiblePeriods: maVisiblePeriods,
            onToggle: onMAToggle,
        },
        {
            type: 'ema',
            label: 'EMA',
            active: emaVisiblePeriods.length > 0,
            availablePeriods: emaAvailablePeriods,
            visiblePeriods: emaVisiblePeriods,
            onToggle: onEMAToggle,
        },
    ];

    const toggleIndicators: ToggleIndicatorConfig[] = [
        { label: 'BB', ...bollinger },
        { label: 'MACD', ...macd },
        { label: 'RSI', ...rsi },
        { label: 'DMI', ...dmi },
        { label: 'Stoch', ...stochastic },
        { label: 'StochRSI', ...stochRsi },
        { label: 'CCI', ...cci },
        { label: 'VP', ...volumeProfile },
        { label: 'Ichimoku', ...ichimoku },
        ...(candlePatterns ? [{ label: '캔들', ...candlePatterns }] : []),
    ];

    const activeDropdownIndicator = dropdownIndicators.find(
        ind => ind.type === openDropdown
    );

    return (
        <div ref={toolbarRef} className="flex flex-col gap-1">
            {dropdownIndicators.map(indicator => (
                <div key={indicator.type} className="flex items-start gap-1">
                    <button
                        ref={buttonRefMap[indicator.type]}
                        type="button"
                        onClick={() => toggleDropdown(indicator.type)}
                        aria-expanded={openDropdown === indicator.type}
                        className={cn(
                            indicatorButtonClass(indicator.active),
                            'w-12 shrink-0'
                        )}
                    >
                        {indicator.label}
                    </button>
                    <PeriodLabels
                        indicatorName={indicator.label}
                        visiblePeriods={indicator.visiblePeriods}
                    />
                </div>
            ))}

            {openDropdown && dropdownPosition && activeDropdownIndicator && (
                <DropdownPortal
                    position={dropdownPosition}
                    indicator={activeDropdownIndicator}
                    portalRef={portalRef}
                />
            )}

            {toggleIndicators.map(indicator => (
                <button
                    key={indicator.label}
                    type="button"
                    onClick={indicator.onToggle}
                    className={indicatorButtonClass(indicator.visible)}
                >
                    {indicator.label}
                </button>
            ))}
        </div>
    );
}
