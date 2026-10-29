'use client';

import { useTranslations } from 'next-intl';
import { type RefObject, useId, useRef } from 'react';
import { useEscapeKey } from '@/shared/hooks/useEscapeKey';
import { useFocusTrap } from '@/shared/hooks/useFocusTrap';
import { useOnClickOutside } from '@/shared/hooks/useOnClickOutside';
import { cn } from '@/shared/lib/cn';
import { BUTTON_GHOST, BUTTON_PRIMARY } from '@/shared/lib/buttonStyles';
import { PopoverSurface } from '@/shared/ui/PopoverSurface';
import type { PortfolioHoldingView } from '@/entities/portfolio/model';
import { useHoldingPopoverForm } from '../hooks/useHoldingPopoverForm';
import type { UseSymbolHoldingReturn } from '../hooks/useSymbolHolding';
import { HoldingAmountField } from './HoldingAmountField';

// `BUTTON_PRIMARY`'s pending look hangs off `disabled:`; this button uses
// `aria-disabled` instead, so the same tones are repeated on that variant.
const SAVE_BUTTON = cn(
    BUTTON_PRIMARY,
    'h-9 flex-1 px-4 text-sm',
    'aria-disabled:cursor-not-allowed aria-disabled:bg-secondary-700 aria-disabled:text-secondary-500'
);
const CANCEL_BUTTON = cn(BUTTON_GHOST, 'h-9 px-3 text-sm');

interface PortfolioChipPopoverProps {
    symbol: string;
    holding: PortfolioHoldingView | null;
    save: UseSymbolHoldingReturn['save'];
    /** The chip button; a pointerdown on it is not an outside click (it toggles instead). */
    triggerRef: RefObject<HTMLButtonElement | null>;
    onClose: () => void;
    /**
     * Viewport read hoisted from `PortfolioChip` (see its JSDoc). This
     * component is `next/dynamic({ ssr: false })`-loaded and only ever mounts
     * once the popover is already open, so an internal `useIsMobileViewport()`
     * call here would start at `false` and only resolve after this
     * component's own effect runs — on EVERY open. That flips `PopoverSurface`
     * from a Fragment to a Portal after mount (different fiber types at the
     * same position), which unmounts/remounts the whole panel subtree: the
     * focus trap's effect deps (`[active, ref]`) are both stable so it never
     * re-arms, and the very first commit paints the anchored (potentially
     * off-screen) desktop layout before the remount corrects it. Taking the
     * value as a prop means it is already resolved by the time this component
     * mounts, so there is nothing to flip.
     */
    isMobile: boolean;
}

/**
 * Small anchored dialog for viewing/setting the current symbol's holding
 * without leaving the symbol page. Symbol is fixed (no autocomplete) — only
 * quantity/averagePrice are editable, pre-filled from `holding` when set.
 *
 * The save button is `aria-disabled` while pending rather than `disabled`: a
 * natively disabled button that holds focus drops it to `body`, and from there
 * Tab leaves the dialog because the focus trap only wraps from its own edges.
 */
export function PortfolioChipPopover({
    symbol,
    holding,
    save,
    triggerRef,
    onClose,
    isMobile,
}: PortfolioChipPopoverProps) {
    const t = useTranslations('features.portfolio-holding');
    const titleId = useId();
    const errorId = useId();
    const panelRef = useRef<HTMLDivElement>(null);
    const form = useHoldingPopoverForm({
        symbol,
        holding,
        save,
        onSaved: onClose,
        unexpectedErrorMessage: t('PortfolioChipPopover.ea9c99'),
    });

    // `isMobile`을 rearmKey로 넘긴다 — 뷰포트가 뒤집히면 PopoverSurface가 인라인
    // 렌더 ↔ 포털 사이를 오가며 패널 노드를 교체하는데, ref의 identity는 그대로라
    // 트랩이 새 노드에 다시 무장되지 않는다(기기 회전 시 포커스가 body로 떨어짐).
    useFocusTrap(panelRef, true, isMobile);
    useEscapeKey(onClose, true);
    useOnClickOutside([panelRef, triggerRef], onClose);

    const errorField = form.error?.field ?? null;

    return (
        <PopoverSurface
            isMobile={isMobile}
            dialogRef={panelRef}
            titleId={titleId}
            desktopClassName="mt-2"
            className={cn(
                'border-secondary-700 bg-secondary-900',
                'overscroll-contain rounded-lg border p-4 shadow-2xl outline-none',
                'motion-safe:animate-[fade-in_150ms_ease-out]'
            )}
        >
            <h2
                id={titleId}
                className="mb-3 text-sm font-semibold text-secondary-100"
            >
                {t('PortfolioChipPopover.51fc60', { v0: symbol.toUpperCase() })}
            </h2>

            <form
                onSubmit={form.handleSubmit}
                noValidate
                className="flex flex-col gap-3"
            >
                <HoldingAmountField
                    id={`${titleId}-quantity`}
                    name="quantity"
                    label={t('PortfolioChipPopover.7294d6')}
                    placeholder={t('PortfolioChipPopover.7c07f7')}
                    value={form.quantity}
                    onValueChange={form.changeQuantity}
                    inputRef={form.quantityRef}
                    invalid={errorField === 'quantity'}
                    errorId={errorId}
                />
                <HoldingAmountField
                    id={`${titleId}-average-price`}
                    name="averagePrice"
                    label={t('PortfolioChipPopover.900beb')}
                    placeholder={t('PortfolioChipPopover.ca59e5')}
                    value={form.averagePrice}
                    onValueChange={form.changeAveragePrice}
                    inputRef={form.priceRef}
                    invalid={errorField === 'averagePrice'}
                    errorId={errorId}
                />

                <div id={errorId} role="alert" className="min-h-5 text-sm">
                    {form.error && (
                        <span className="text-ui-danger-text">
                            {form.error.message}
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="submit"
                        aria-disabled={form.isPending || undefined}
                        aria-busy={form.isPending}
                        className={SAVE_BUTTON}
                    >
                        {form.isPending
                            ? t('PortfolioChipPopover.9f6785')
                            : t('PortfolioChipPopover.1f1712')}
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className={CANCEL_BUTTON}
                    >
                        {t('PortfolioChipPopover.19b2d1')}
                    </button>
                </div>
            </form>
        </PopoverSurface>
    );
}
