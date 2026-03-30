'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { getPeriodColor } from '@/domain/constants/colors';

interface IndicatorToggleGroup {
    visible: boolean;
    onToggle: () => void;
}

type DropdownType = 'ma' | 'ema' | null;

const indicatorButtonClass = (active: boolean): string =>
    cn(
        'rounded px-2 py-1 text-xs font-medium transition-colors',
        active
            ? 'bg-secondary-700 text-white'
            : 'bg-secondary-800/80 text-secondary-400 hover:bg-secondary-700 hover:text-white'
    );

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

    useEffect(() => {
        if (!openDropdown) return;

        const handleClickOutside = (event: MouseEvent) => {
            if (
                toolbarRef.current &&
                !toolbarRef.current.contains(event.target as Node)
            ) {
                setOpenDropdown(null);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [openDropdown]);

    const toggleDropdown = (type: DropdownType) => {
        setOpenDropdown(prev => (prev === type ? null : type));
    };

    const maActive = maVisiblePeriods.length > 0;
    const emaActive = emaVisiblePeriods.length > 0;

    return (
        <div ref={toolbarRef} className="flex flex-col gap-1">
            {/* MA 드롭다운 */}
            <div className="relative">
                <button
                    type="button"
                    onClick={() => toggleDropdown('ma')}
                    aria-expanded={openDropdown === 'ma'}
                    className={indicatorButtonClass(maActive)}
                >
                    MA
                </button>
                {openDropdown === 'ma' && (
                    <div className="border-secondary-700 bg-secondary-800 absolute top-full left-0 mt-1 flex flex-col gap-0.5 rounded border p-1 shadow-lg">
                        {maAvailablePeriods.map(period => (
                            <button
                                key={period}
                                type="button"
                                onClick={() => onMAToggle(period)}
                                className={cn(
                                    'flex items-center gap-2 rounded px-2 py-1 text-xs transition-colors',
                                    maVisiblePeriods.includes(period)
                                        ? 'bg-secondary-700 text-white'
                                        : 'text-secondary-400 hover:bg-secondary-700 hover:text-white'
                                )}
                            >
                                <span
                                    className="h-2 w-2 shrink-0 rounded-full"
                                    style={{
                                        backgroundColor: getPeriodColor(period),
                                    }}
                                />
                                {period}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* EMA 드롭다운 */}
            <div className="relative">
                <button
                    type="button"
                    onClick={() => toggleDropdown('ema')}
                    aria-expanded={openDropdown === 'ema'}
                    className={indicatorButtonClass(emaActive)}
                >
                    EMA
                </button>
                {openDropdown === 'ema' && (
                    <div className="border-secondary-700 bg-secondary-800 absolute top-full left-0 mt-1 flex flex-col gap-0.5 rounded border p-1 shadow-lg">
                        {emaAvailablePeriods.map(period => (
                            <button
                                key={period}
                                type="button"
                                onClick={() => onEMAToggle(period)}
                                className={cn(
                                    'flex items-center gap-2 rounded px-2 py-1 text-xs transition-colors',
                                    emaVisiblePeriods.includes(period)
                                        ? 'bg-secondary-700 text-white'
                                        : 'text-secondary-400 hover:bg-secondary-700 hover:text-white'
                                )}
                            >
                                <span
                                    className="h-2 w-2 shrink-0 rounded-full"
                                    style={{
                                        backgroundColor: getPeriodColor(period),
                                    }}
                                />
                                {period}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Bollinger 토글 */}
            <button
                type="button"
                onClick={bollinger.onToggle}
                className={indicatorButtonClass(bollinger.visible)}
            >
                BB
            </button>

            {/* MACD 토글 */}
            <button
                type="button"
                onClick={macd.onToggle}
                className={indicatorButtonClass(macd.visible)}
            >
                MACD
            </button>

            {/* RSI 토글 */}
            <button
                type="button"
                onClick={rsi.onToggle}
                className={indicatorButtonClass(rsi.visible)}
            >
                RSI
            </button>

            {/* DMI 토글 */}
            <button
                type="button"
                onClick={dmi.onToggle}
                className={indicatorButtonClass(dmi.visible)}
            >
                DMI
            </button>
        </div>
    );
}
