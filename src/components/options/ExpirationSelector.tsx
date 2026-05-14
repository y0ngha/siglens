'use client';

import { InfoTooltip } from '@/components/ui/InfoTooltip';
import type { SlotMapping } from '@y0ngha/siglens-core';

interface ExpirationSelectorProps {
    /** Slot mappings filtered to non-null entries (`OptionsPageClient` filters before passing). */
    slots: ReadonlyArray<SlotMapping>;
    /** Current selection — an ISO 'YYYY-MM-DD' string or `'all'`. */
    value: string | 'all';
    onChange: (next: string | 'all') => void;
}

/**
 * Tab-style expiration selector. Each chip is a `role="tab"` with
 * `aria-selected` for screen-reader friendliness. The trailing "종합" chip
 * always renders so users can request a cross-expiration aggregate.
 */
export function ExpirationSelector({
    slots,
    value,
    onChange,
}: ExpirationSelectorProps) {
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
            {slots.map(({ slot, expirationDate }) => {
                const active = value === expirationDate;
                return (
                    <button
                        key={slot.key}
                        role="tab"
                        type="button"
                        aria-selected={active}
                        onClick={() => onChange(expirationDate)}
                        className={
                            active
                                ? 'border-primary-500 bg-primary-500/10 text-primary-400 focus-visible:ring-primary-500 inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none'
                                : 'border-secondary-600 text-secondary-300 hover:border-primary-500 hover:text-primary-400 focus-visible:ring-primary-500 inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none'
                        }
                    >
                        <span>{slot.label}</span>
                        <span className="text-secondary-500 font-mono text-[10px]">
                            {expirationDate.slice(5)}
                        </span>
                    </button>
                );
            })}
            <button
                role="tab"
                type="button"
                aria-selected={value === 'all'}
                onClick={() => onChange('all')}
                className={
                    value === 'all'
                        ? 'border-primary-500 bg-primary-500/10 text-primary-400 focus-visible:ring-primary-500 inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none'
                        : 'border-secondary-600 text-secondary-300 hover:border-primary-500 hover:text-primary-400 focus-visible:ring-primary-500 inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none'
                }
            >
                종합
            </button>
        </div>
    );
}
