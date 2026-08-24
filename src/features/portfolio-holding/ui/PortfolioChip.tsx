'use client';

import dynamic from 'next/dynamic';
import { useRef, useState } from 'react';
import { useIsMobileViewport } from '@/shared/hooks/useIsMobileViewport';
import { currencyForSymbol } from '@/shared/config/marketProfile';
import { cn } from '@/shared/lib/cn';
import { trimTrailingZeros } from '@/shared/lib/trimTrailingZeros';
import { useSymbolHolding } from '../hooks/useSymbolHolding';

// Code-split: the popover pulls in the holding form + mutation code, which
// only members who actually open it should download. Guests (and members who
// never click the chip) never fetch this bundle.
const PortfolioChipPopover = dynamic(
    () => import('./PortfolioChipPopover').then(m => m.PortfolioChipPopover),
    { ssr: false }
);

interface PortfolioChipProps {
    symbol: string;
}

/**
 * Header chip that shows/sets the current symbol's holding without leaving
 * the symbol page. Visually mirrors ReasoningToggle/ModelSelector's control
 * language (rounded-lg border) so it reads as part of the same cluster; the
 * trigger is sized to a min-h-11 (44px) mobile touch target rather than a
 * fixed h-9 to meet WCAG 2.5.8 target size.
 *
 * Keep this component free of mount-time side effects for parity with the
 * dual-mounted fear-greed chip and to stay safe if the header layout later
 * duplicates this cluster.
 *
 * Owns the `useIsMobileViewport()` read (rather than letting
 * `PortfolioChipPopover` read it itself) so the value is already resolved by
 * the time the user can even tap the trigger — this component is mounted
 * from page load and gated on `isHydrated` below, so its viewport effect has
 * long since run before `isOpen` can flip. `PortfolioChipPopover` is
 * `next/dynamic({ ssr: false })` and only mounts ON open, so if IT read the
 * hook internally, every open would start from `false` and only resolve
 * after ITS OWN effect ran — flipping `PopoverSurface` from a Fragment to a
 * Portal after mount (different fiber types at the same position), which
 * silently disarms `useFocusTrap` (stable `[active, ref]` deps never re-run)
 * and paints one frame of the anchored, potentially off-screen desktop
 * layout. Reading it here and passing it down as a prop means
 * `PortfolioChipPopover` never observes that transition.
 */
export function PortfolioChip({ symbol }: PortfolioChipProps) {
    const [isOpen, setIsOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const isMobileViewport = useIsMobileViewport();
    const { holding, isHydrated, isLoading, isError, save } =
        useSymbolHolding(symbol);

    // Rendering during hydration risks an SSR/CSR text mismatch (the holdings
    // query is client-only and gated on isHydrated itself). Before hydration we
    // render nothing at all so SSR and the first client paint stay identical (no
    // hydration mismatch). Once hydrated, a member with the holdings query still
    // loading gets a fixed-size placeholder so the resolved chip doesn't
    // pop into the flex-wrap header cluster and shift its siblings (CLS). On
    // error we still hide entirely: rendering the "설정" (unset) button would
    // falsely tell a member with existing holdings that nothing is set yet.
    if (!isHydrated) return null;
    if (isError) return null;
    if (isLoading) {
        return (
            <span
                className="inline-flex min-h-11 w-24 animate-pulse rounded-lg bg-secondary-700/40"
                aria-hidden="true"
            />
        );
    }

    // 통화는 심볼에서 유도한다(currencyForSymbol) — 이 칩은 헤더에 상주해 모든 KR
    // 탭에서 노출되므로, 하드코딩된 `$`는 원화 종목(005930.KS)에도 달러 기호를
    // 찍어 접근 가능한 이름(aria)에까지 오표기가 새는 버그였다.
    const currencyPrefix = currencyForSymbol(symbol) === 'KRW' ? '₩' : '$';
    const label =
        holding === null
            ? '평단 설정'
            : `평단 ${currencyPrefix}${trimTrailingZeros(holding.averagePrice)} · ${trimTrailingZeros(holding.quantity)}주`;

    return (
        <div className="relative inline-block">
            <button
                ref={triggerRef}
                type="button"
                aria-haspopup="dialog"
                aria-expanded={isOpen}
                onClick={() => setIsOpen(open => !open)}
                className={cn(
                    'inline-flex min-h-11 touch-manipulation items-center gap-1 rounded-lg border px-2.5 text-xs font-medium whitespace-nowrap tabular-nums transition-colors',
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
                    isMobile={isMobileViewport}
                />
            )}
        </div>
    );
}
