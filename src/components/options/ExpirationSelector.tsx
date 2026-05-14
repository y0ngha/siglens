'use client';

import { useMemo, useRef, type KeyboardEvent } from 'react';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import { cn } from '@/lib/cn';
import type { SlotMapping } from '@y0ngha/siglens-core';

interface ExpirationSelectorProps {
    /** Slot mappings filtered to non-null entries (`OptionsPageClient` filters before passing). */
    slots: ReadonlyArray<SlotMapping>;
    /** Current selection — an ISO 'YYYY-MM-DD' string or `'all'`. */
    value: string | 'all';
    onChange: (next: string | 'all') => void;
}

interface TabDescriptor {
    key: string;
    label: string;
    /** Selection value forwarded to `onChange`. */
    value: string | 'all';
    /** Optional secondary label (e.g. month-day slice). */
    sub?: string;
}

const CHIP_BASE =
    'focus-visible:ring-primary-500 inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none';
const CHIP_ACTIVE = 'border-primary-500 bg-primary-500/10 text-primary-400';
const CHIP_INACTIVE =
    'border-secondary-600 text-secondary-300 hover:border-primary-500 hover:text-primary-400';

/**
 * Tab-style expiration selector. Implements the WAI-ARIA tabs pattern:
 * roving `tabIndex` (active tab is `0`, others `-1`) and Left/Right/Home/End
 * key navigation. Selecting a chip immediately fires `onChange` (automatic
 * activation, consistent with the existing SymbolTabs pattern in this app).
 */
export function ExpirationSelector({
    slots,
    value,
    onChange,
}: ExpirationSelectorProps) {
    const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

    const tabs = useMemo<TabDescriptor[]>(
        () => [
            ...slots.map(({ slot, expirationDate }) => ({
                key: slot.key,
                label: slot.label,
                value: expirationDate as string | 'all',
                sub: expirationDate.slice(5),
            })),
            { key: 'all', label: '종합', value: 'all' as const },
        ],
        [slots]
    );

    const activeIndex = useMemo(
        () =>
            Math.max(
                tabs.findIndex(t => t.value === value),
                0
            ),
        [tabs, value]
    );

    const focusTabAt = (index: number): void => {
        const normalized = (index + tabs.length) % tabs.length;
        const next = tabs[normalized];
        if (next === undefined) return;
        onChange(next.value);
        buttonRefs.current[normalized]?.focus();
    };

    const handleKeyDown = (
        event: KeyboardEvent<HTMLButtonElement>,
        index: number
    ): void => {
        switch (event.key) {
            case 'ArrowRight':
                event.preventDefault();
                focusTabAt(index + 1);
                break;
            case 'ArrowLeft':
                event.preventDefault();
                focusTabAt(index - 1);
                break;
            case 'Home':
                event.preventDefault();
                focusTabAt(0);
                break;
            case 'End':
                event.preventDefault();
                focusTabAt(tabs.length - 1);
                break;
            default:
                break;
        }
    };

    return (
        <div
            className="border-secondary-700 bg-secondary-800 flex flex-wrap items-center gap-2 overflow-x-auto rounded-xl border p-3"
            role="tablist"
            aria-label="옵션 만기 선택"
        >
            <span className="text-secondary-400 mr-1 text-xs tracking-widest uppercase">
                만기
                <InfoTooltip>
                    <p>옵션 계약이 만료되는 날짜예요.</p>
                    <p>
                        가까운 만기일수록 가격 변동이 빨라요. 만기일이 지나면
                        옵션은 사라져요.
                    </p>
                </InfoTooltip>
            </span>
            {tabs.map((tab, index) => {
                const active = index === activeIndex;
                return (
                    <button
                        key={tab.key}
                        ref={el => {
                            buttonRefs.current[index] = el;
                        }}
                        role="tab"
                        type="button"
                        aria-selected={active}
                        tabIndex={active ? 0 : -1}
                        onClick={() => onChange(tab.value)}
                        onKeyDown={e => handleKeyDown(e, index)}
                        className={cn(
                            CHIP_BASE,
                            active ? CHIP_ACTIVE : CHIP_INACTIVE
                        )}
                    >
                        <span>{tab.label}</span>
                        {tab.sub !== undefined && (
                            <span className="text-secondary-500 font-mono text-[10px]">
                                {tab.sub}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
