'use client';

import { useRef, useState } from 'react';
import { cn } from '@/shared/lib/cn';
import { trimTrailingZeros } from '../lib/formatDecimal';
import { useSymbolHolding } from '../hooks/useSymbolHolding';
import { PortfolioChipPopover } from './PortfolioChipPopover';

interface PortfolioChipProps {
    symbol: string;
}

/**
 * Header chip that shows/sets the current symbol's holding without leaving
 * the symbol page. Visually mirrors ReasoningToggle/ModelSelector's control
 * sizing (h-9, rounded-lg border) so it reads as part of the same cluster.
 *
 * This header cluster mounts twice (desktop + mobile) — no mount-time side
 * effects here, only local UI state, so a second mount is safe.
 */
export function PortfolioChip({ symbol }: PortfolioChipProps) {
    const { holding, isHydrated, save } = useSymbolHolding(symbol);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const [isOpen, setIsOpen] = useState(false);

    // Rendering during hydration risks an SSR/CSR text mismatch (the holdings
    // query is client-only and gated on isHydrated itself) — same rationale
    // as FearGreedHeaderChipMounted, except here we simply hide until ready
    // rather than show a skeleton, since an unset holding renders nothing
    // visually distinct from "not yet known".
    if (!isHydrated) return null;

    const label =
        holding === null
            ? '내 평단 설정'
            : `내 평단 $${trimTrailingZeros(holding.averagePrice)} · ${trimTrailingZeros(holding.quantity)}주`;

    return (
        <div className="relative inline-block">
            <button
                ref={triggerRef}
                type="button"
                aria-haspopup="dialog"
                aria-expanded={isOpen}
                onClick={() => setIsOpen(open => !open)}
                className={cn(
                    'inline-flex h-9 items-center gap-1 rounded-lg border px-2.5 text-xs font-medium whitespace-nowrap tabular-nums transition-colors',
                    'focus-visible:ring-primary-500 focus-visible:ring-2 focus-visible:outline-none',
                    holding === null
                        ? 'border-secondary-700 text-secondary-300 hover:border-secondary-600 hover:bg-secondary-700/30 hover:text-secondary-100'
                        : 'border-primary-800/60 bg-primary-900/10 text-primary-300 hover:bg-primary-900/20'
                )}
            >
                {label}
            </button>

            {isOpen && (
                <PortfolioChipPopover
                    symbol={symbol}
                    holding={holding}
                    save={save}
                    triggerRef={triggerRef}
                    onClose={() => setIsOpen(false)}
                />
            )}
        </div>
    );
}
