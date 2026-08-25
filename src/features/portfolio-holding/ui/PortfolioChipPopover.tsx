'use client';

import { type RefObject, useId, useRef, useState } from 'react';
import { useEscapeKey } from '@/shared/hooks/useEscapeKey';
import { useFocusTrap } from '@/shared/hooks/useFocusTrap';
import { useOnClickOutside } from '@/shared/hooks/useOnClickOutside';
import { cn } from '@/shared/lib/cn';
import { stripNegativeSign } from '@/shared/lib/stripNegativeSign';
import { trimTrailingZeros } from '@/shared/lib/trimTrailingZeros';
import { PopoverSurface } from '@/shared/ui/PopoverSurface';
import type {
    PortfolioActionErrorCode,
    PortfolioHoldingView,
} from '@/entities/portfolio';
import type { UseSymbolHoldingReturn } from '../hooks/useSymbolHolding';

const FIELD_LABEL = 'text-secondary-400 mb-1 block text-xs font-medium';
const FIELD_INPUT =
    'bg-secondary-950 border-border-control text-secondary-100 placeholder-secondary-400 focus:border-primary-500 focus:ring-primary-500/40 h-10 w-full touch-manipulation rounded-lg border px-3 text-sm tabular-nums transition-colors outline-none focus:ring-2';
const FIELD_INPUT_ERROR =
    'border-ui-danger focus:border-ui-danger focus:ring-ui-danger/40';
const BUTTON_PRIMARY =
    'bg-primary-600 hover:bg-primary-700 focus-visible:ring-primary-500 inline-flex h-9 flex-1 touch-manipulation items-center justify-center rounded-lg px-4 text-sm font-semibold text-white transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50';
const BUTTON_GHOST =
    'text-secondary-400 hover:text-secondary-200 focus-visible:ring-primary-500 inline-flex h-9 touch-manipulation items-center justify-center rounded-lg px-3 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none';

/** Which field a `PortfolioActionErrorCode` should be surfaced against. The symbol here is fixed (not user-editable), so `invalid_symbol` has no dedicated field — it renders only the alert message. */
type PopoverErrorField = 'quantity' | 'averagePrice' | null;

function fieldForErrorCode(code: PortfolioActionErrorCode): PopoverErrorField {
    switch (code) {
        case 'invalid_quantity':
            return 'quantity';
        case 'invalid_price':
            return 'averagePrice';
        default:
            return null;
    }
}

interface PortfolioChipPopoverProps {
    symbol: string;
    holding: PortfolioHoldingView | null;
    save: UseSymbolHoldingReturn['save'];
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
 */
export function PortfolioChipPopover({
    symbol,
    holding,
    save,
    triggerRef,
    onClose,
    isMobile,
}: PortfolioChipPopoverProps) {
    const titleId = useId();
    const errorId = useId();
    const [quantity, setQuantity] = useState(
        holding ? trimTrailingZeros(holding.quantity) : ''
    );
    const [averagePrice, setAveragePrice] = useState(
        holding ? trimTrailingZeros(holding.averagePrice) : ''
    );
    const [error, setError] = useState<string | null>(null);
    const [errorField, setErrorField] = useState<PopoverErrorField>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const quantityRef = useRef<HTMLInputElement>(null);
    const priceRef = useRef<HTMLInputElement>(null);

    // `isMobile`을 rearmKey로 넘긴다 — 뷰포트가 뒤집히면 PopoverSurface가 인라인
    // 렌더 ↔ 포털 사이를 오가며 패널 노드를 교체하는데, ref의 identity는 그대로라
    // 트랩이 새 노드에 다시 무장되지 않는다(기기 회전 시 포커스가 body로 떨어짐).
    useFocusTrap(panelRef, true, isMobile);
    useEscapeKey(onClose, true);
    useOnClickOutside([panelRef, triggerRef], onClose);

    const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (save.isPending) return;
        setError(null);
        setErrorField(null);
        try {
            const result = await save.mutateAsync({
                symbol,
                quantity,
                averagePrice,
            });
            if (result.status === 'error') {
                setError(result.message);
                const field = fieldForErrorCode(result.code);
                setErrorField(field);
                if (field === 'quantity') quantityRef.current?.focus();
                else if (field === 'averagePrice') priceRef.current?.focus();
                return;
            }
            onClose();
        } catch {
            setError('요청 처리 중 문제가 발생했어요. 다시 시도해 주세요.');
        }
    };

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
                {symbol.toUpperCase()} 평단 설정
            </h2>

            <form
                onSubmit={handleSubmit}
                noValidate
                className="flex flex-col gap-3"
            >
                <div>
                    <label
                        htmlFor={`${titleId}-quantity`}
                        className={FIELD_LABEL}
                    >
                        수량
                    </label>
                    <input
                        ref={quantityRef}
                        id={`${titleId}-quantity`}
                        name="quantity"
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        required
                        placeholder="예: 10…"
                        value={quantity}
                        onChange={e =>
                            setQuantity(stripNegativeSign(e.target.value))
                        }
                        aria-invalid={errorField === 'quantity'}
                        aria-describedby={
                            errorField === 'quantity' ? errorId : undefined
                        }
                        className={cn(
                            FIELD_INPUT,
                            errorField === 'quantity' && FIELD_INPUT_ERROR
                        )}
                    />
                </div>
                <div>
                    <label
                        htmlFor={`${titleId}-average-price`}
                        className={FIELD_LABEL}
                    >
                        평단
                    </label>
                    <input
                        ref={priceRef}
                        id={`${titleId}-average-price`}
                        name="averagePrice"
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        required
                        placeholder="예: 152.35…"
                        value={averagePrice}
                        onChange={e =>
                            setAveragePrice(stripNegativeSign(e.target.value))
                        }
                        aria-invalid={errorField === 'averagePrice'}
                        aria-describedby={
                            errorField === 'averagePrice' ? errorId : undefined
                        }
                        className={cn(
                            FIELD_INPUT,
                            errorField === 'averagePrice' && FIELD_INPUT_ERROR
                        )}
                    />
                </div>

                <div id={errorId} role="alert" className="min-h-5 text-sm">
                    {error && <span className="text-ui-danger">{error}</span>}
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="submit"
                        disabled={save.isPending}
                        aria-busy={save.isPending}
                        className={BUTTON_PRIMARY}
                    >
                        {save.isPending ? '저장 중…' : '저장'}
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className={BUTTON_GHOST}
                    >
                        취소
                    </button>
                </div>
            </form>
        </PopoverSurface>
    );
}
