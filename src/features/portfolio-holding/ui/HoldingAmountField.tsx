'use client';

import type { RefObject } from 'react';
import { cn } from '@/shared/lib/cn';

const FIELD_LABEL = 'text-secondary-400 mb-1 block text-xs font-medium';
const FIELD_INPUT =
    'bg-secondary-950 border-border-control text-secondary-100 placeholder-secondary-400 focus:border-primary-500 focus:ring-primary-500/40 h-10 w-full touch-manipulation rounded-lg border px-3 text-sm tabular-nums transition-colors outline-none focus:ring-2';
const FIELD_INPUT_ERROR =
    'border-ui-danger focus:border-ui-danger focus:ring-ui-danger/40';

interface HoldingAmountFieldProps {
    id: string;
    name: string;
    label: string;
    placeholder: string;
    value: string;
    onValueChange: (value: string) => void;
    /** Lets the form move focus here when the server rejects this field. */
    inputRef: RefObject<HTMLInputElement | null>;
    /** Marks the input invalid and points `aria-describedby` at `errorId`. */
    invalid: boolean;
    /** Id of the form's shared alert region. */
    errorId: string;
}

/**
 * Labelled decimal text input for one holding amount (quantity or average
 * price) in `PortfolioChipPopover`. `type="text"` + `inputMode="decimal"` keeps
 * the exact decimal string the user typed instead of coercing it through a float.
 */
export function HoldingAmountField({
    id,
    name,
    label,
    placeholder,
    value,
    onValueChange,
    inputRef,
    invalid,
    errorId,
}: HoldingAmountFieldProps) {
    return (
        <div>
            <label htmlFor={id} className={FIELD_LABEL}>
                {label}
            </label>
            <input
                ref={inputRef}
                id={id}
                name={name}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                required
                placeholder={placeholder}
                value={value}
                onChange={e => onValueChange(e.target.value)}
                aria-invalid={invalid}
                aria-describedby={invalid ? errorId : undefined}
                className={cn(FIELD_INPUT, invalid && FIELD_INPUT_ERROR)}
            />
        </div>
    );
}
