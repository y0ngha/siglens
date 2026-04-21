'use client';

import type { CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';
import { getPeriodColor } from '@/lib/chartColors';
import {
    type DropdownPosition,
    type IndicatorDropdownType,
    useIndicatorDropdown,
} from '@/components/chart/hooks/useIndicatorDropdown';

interface IndicatorToggleGroup {
    visible: boolean;
    onToggle: () => void;
}

const TOOLBAR_LABEL_EXPANDED = 'Hide indicators';
const TOOLBAR_LABEL_COLLAPSED = 'Show indicators';

const indicatorButtonClass = (active: boolean): string =>
    cn(
        'rounded px-2 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary-500',
        active
            ? 'bg-secondary-700 text-white'
            : 'bg-secondary-800/80 text-secondary-400 hover:bg-secondary-700 hover:text-white'
    );

const COLLAPSE_BUTTON_ACTIVE = false as const;

interface DropdownIndicatorConfig {
    type: IndicatorDropdownType;
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
                    <span
                        className="inline-block h-1.5 w-3 shrink-0 rounded-sm bg-[var(--period-color)]"
                        style={
                            {
                                '--period-color': getPeriodColor(period),
                            } as CSSProperties
                        }
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
            className="border-secondary-700 bg-secondary-800 fixed top-[var(--dp-top)] left-[var(--dp-left)] z-50 flex flex-col gap-0.5 rounded border p-1 shadow-lg"
            style={
                {
                    '--dp-top': `${position.top}px`,
                    '--dp-left': `${position.left}px`,
                } as CSSProperties
            }
        >
            {indicator.availablePeriods.map(period => (
                <button
                    key={period}
                    type="button"
                    onClick={() => indicator.onToggle(period)}
                    className={cn(
                        'focus-visible:ring-primary-500 flex items-center gap-2 rounded px-2 py-1 text-xs transition-colors focus-visible:ring-1 focus-visible:outline-none',
                        indicator.visiblePeriods.includes(period)
                            ? 'bg-secondary-700 text-white'
                            : 'text-secondary-400 hover:bg-secondary-700 hover:text-white'
                    )}
                >
                    <span
                        className="h-2 w-2 shrink-0 rounded-full bg-[var(--period-color)]"
                        style={
                            {
                                '--period-color': getPeriodColor(period),
                            } as CSSProperties
                        }
                    />
                    {period}
                </button>
            ))}
        </div>,
        document.body
    );
}

interface CollapseToggleIconProps {
    isExpanded: boolean;
}

function CollapseToggleIcon({ isExpanded }: CollapseToggleIconProps) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className={cn(
                'h-4 w-4 transition-transform duration-200',
                isExpanded && 'rotate-180'
            )}
        >
            <path
                fillRule="evenodd"
                d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
                clipRule="evenodd"
            />
        </svg>
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
}: IndicatorToolbarProps) {
    const {
        isExpanded,
        openDropdown,
        dropdownPosition,
        toolbarRef,
        portalRef,
        buttonRefs,
        toggleExpanded,
        toggleDropdown,
    } = useIndicatorDropdown();

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
        { label: 'RSI', ...rsi },
        { label: 'MACD', ...macd },
        { label: 'DMI', ...dmi },
        { label: 'Stoch', ...stochastic },
        { label: 'StochRSI', ...stochRsi },
        { label: 'CCI', ...cci },
        { label: 'VP', ...volumeProfile },
        { label: 'Ichimoku', ...ichimoku },
    ];

    const activeDropdownIndicator = dropdownIndicators.find(
        ind => ind.type === openDropdown
    );

    return (
        <div ref={toolbarRef} className="flex flex-col gap-1">
            <button
                type="button"
                onClick={toggleExpanded}
                aria-expanded={isExpanded}
                aria-label={
                    isExpanded
                        ? TOOLBAR_LABEL_EXPANDED
                        : TOOLBAR_LABEL_COLLAPSED
                }
                className={cn(
                    indicatorButtonClass(COLLAPSE_BUTTON_ACTIVE),
                    'flex w-12 items-center justify-center'
                )}
            >
                <CollapseToggleIcon isExpanded={isExpanded} />
            </button>

            {isExpanded && (
                <>
                    {dropdownIndicators.map(indicator => (
                        <div
                            key={indicator.type}
                            className="flex min-w-12 items-start gap-1"
                        >
                            <button
                                ref={buttonRefs[indicator.type]}
                                type="button"
                                onClick={() => toggleDropdown(indicator.type)}
                                aria-expanded={openDropdown === indicator.type}
                                className={cn(
                                    indicatorButtonClass(indicator.active),
                                    'shrink-0'
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

                    {openDropdown &&
                        dropdownPosition &&
                        activeDropdownIndicator && (
                            <DropdownPortal
                                position={dropdownPosition}
                                indicator={activeDropdownIndicator}
                                portalRef={portalRef}
                            />
                        )}

                    {toggleIndicators.map(indicator => (
                        <div
                            key={indicator.label}
                            className="flex min-w-12 items-start gap-1"
                        >
                            <button
                                type="button"
                                onClick={indicator.onToggle}
                                className={cn(
                                    indicatorButtonClass(indicator.visible),
                                    'shrink-0'
                                )}
                            >
                                {indicator.label}
                            </button>
                        </div>
                    ))}
                </>
            )}
        </div>
    );
}
