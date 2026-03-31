'use client';

import { useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { getPeriodColor } from '@/domain/constants/colors';
import { useOnClickOutside } from '@/components/chart/hooks/useOnClickOutside';

interface IndicatorToggleGroup {
    visible: boolean;
    onToggle: () => void;
}

type IndicatorType = 'ma' | 'ema';

type DropdownType = IndicatorType | null;

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
}: IndicatorToolbarProps) {
    const [openDropdown, setOpenDropdown] = useState<DropdownType>(null);
    const toolbarRef = useRef<HTMLDivElement>(null);

    useOnClickOutside(toolbarRef, () => setOpenDropdown(null));

    const toggleDropdown = (type: DropdownType) => {
        setOpenDropdown(prev => (prev === type ? null : type));
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
    ];

    return (
        <div ref={toolbarRef} className="flex flex-col gap-1">
            {dropdownIndicators.map(indicator => (
                <div key={indicator.type} className="relative">
                    <button
                        type="button"
                        onClick={() => toggleDropdown(indicator.type)}
                        aria-expanded={openDropdown === indicator.type}
                        className={indicatorButtonClass(indicator.active)}
                    >
                        {indicator.label}
                    </button>
                    {openDropdown === indicator.type && (
                        <div className="border-secondary-700 bg-secondary-800 absolute top-full left-0 mt-1 flex flex-col gap-0.5 rounded border p-1 shadow-lg">
                            {indicator.availablePeriods.map(period => (
                                <button
                                    key={period}
                                    type="button"
                                    onClick={() => indicator.onToggle(period)}
                                    className={cn(
                                        'flex items-center gap-2 rounded px-2 py-1 text-xs transition-colors',
                                        indicator.visiblePeriods.includes(
                                            period
                                        )
                                            ? 'bg-secondary-700 text-white'
                                            : 'text-secondary-400 hover:bg-secondary-700 hover:text-white'
                                    )}
                                >
                                    {/* getPeriodColor는 런타임에 결정되는 동적 도메인 색상 상수(CHART_COLORS)를 반환하므로 style prop 사용 허용 */}
                                    <span
                                        className="h-2 w-2 shrink-0 rounded-full"
                                        style={{
                                            backgroundColor:
                                                getPeriodColor(period),
                                        }}
                                    />
                                    {period}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            ))}

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
