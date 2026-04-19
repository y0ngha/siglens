'use client';

import { useCallback } from 'react';
import { cn } from '@/lib/cn';
import { SECTOR_ETFS } from '@/domain/constants/dashboard-tickers';

interface SectorTabsProps {
    activeSector: string;
    onChange: (sectorSymbol: string) => void;
}

export function SectorTabs({ activeSector, onChange }: SectorTabsProps) {
    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
            const total = SECTOR_ETFS.length;
            let nextIndex = -1;
            if (e.key === 'ArrowRight') nextIndex = (index + 1) % total;
            else if (e.key === 'ArrowLeft') nextIndex = (index - 1 + total) % total;
            else if (e.key === 'Home') nextIndex = 0;
            else if (e.key === 'End') nextIndex = total - 1;
            if (nextIndex !== -1) {
                e.preventDefault();
                onChange(SECTOR_ETFS[nextIndex].symbol);
                const nextBtn = e.currentTarget.parentElement?.children[nextIndex] as HTMLElement;
                nextBtn?.focus();
            }
        },
        [onChange]
    );

    return (
        <div
            role="tablist"
            aria-label="섹터 선택"
            className="flex touch-manipulation gap-6 overflow-x-auto overscroll-x-contain border-b border-secondary-700 pb-0"
            style={{ scrollbarWidth: 'thin' }}
        >
            {SECTOR_ETFS.map((etf, i) => {
                const isActive = etf.symbol === activeSector;
                return (
                    <button
                        key={etf.symbol}
                        role="tab"
                        aria-selected={isActive}
                        aria-controls={`sector-panel-${etf.symbol}`}
                        tabIndex={isActive ? 0 : -1}
                        onClick={() => onChange(etf.symbol)}
                        onKeyDown={e => handleKeyDown(e, i)}
                        className={cn(
                            'min-h-11 shrink-0 border-b-2 px-2 pt-2 pb-2 text-xs font-semibold tracking-[0.12em] uppercase transition-colors duration-150 -mb-px',
                            isActive
                                ? 'text-secondary-50 border-primary-500'
                                : 'text-secondary-400 border-transparent hover:text-secondary-200',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded-t'
                        )}
                    >
                        {etf.koreanName}
                    </button>
                );
            })}
        </div>
    );
}
