'use client';

import { useCallback } from 'react';
import { cn } from '@/lib/cn';
import { SIGNAL_SECTORS } from '@/domain/constants/dashboard-tickers';

interface SectorTabsProps {
    activeSector: string;
    onChange: (sectorSymbol: string) => void;
}

export function SectorTabs({ activeSector, onChange }: SectorTabsProps) {
    const total = SIGNAL_SECTORS.length;

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
            const KEY_MAP: Partial<Record<string, number>> = {
                ArrowRight: (index + 1) % total,
                ArrowLeft: (index - 1 + total) % total,
                Home: 0,
                End: total - 1,
            };
            const nextIndex = KEY_MAP[e.key] ?? -1;
            if (nextIndex === -1) return;
            e.preventDefault();
            onChange(SIGNAL_SECTORS[nextIndex].symbol);
            const parent = e.currentTarget.parentElement;
            const nextBtn = parent?.children[nextIndex] as
                | HTMLElement
                | undefined;
            nextBtn?.focus();
        },
        [onChange, total]
    );

    return (
        <div
            role="tablist"
            aria-label="섹터 선택"
            className="border-secondary-700 flex touch-manipulation gap-6 overflow-x-auto overflow-y-hidden overscroll-x-contain border-b pb-0"
        >
            {SIGNAL_SECTORS.map((etf, i) => {
                const isActive = etf.symbol === activeSector;
                return (
                    <button
                        key={etf.symbol}
                        id={`sector-tab-${etf.symbol}`}
                        role="tab"
                        aria-selected={isActive}
                        aria-controls={`sector-panel-${etf.symbol}`}
                        tabIndex={isActive ? 0 : -1}
                        onClick={() => onChange(etf.symbol)}
                        onKeyDown={e => handleKeyDown(e, i)}
                        className={cn(
                            '-mb-px min-h-11 shrink-0 border-b-2 px-2 pt-2 pb-2 text-xs font-semibold tracking-[0.12em] uppercase transition-colors duration-150',
                            isActive
                                ? 'text-secondary-50 border-primary-500'
                                : 'text-secondary-400 hover:text-secondary-200 border-transparent',
                            'focus-visible:ring-primary-500 rounded-t focus-visible:ring-2 focus-visible:outline-none'
                        )}
                    >
                        {etf.koreanName}
                    </button>
                );
            })}
        </div>
    );
}
