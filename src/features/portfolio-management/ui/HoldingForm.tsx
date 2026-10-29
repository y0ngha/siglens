'use client';

import { useId } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/shared/lib/cn';
import type {
    PortfolioHoldingView,
    RawHoldingInput,
    SavePortfolioResult,
} from '@/entities/portfolio/model';
import { useHoldingForm } from '../hooks/useHoldingForm';
import {
    CANCEL_BUTTON,
    FIELD_INPUT,
    FIELD_INPUT_ERROR,
    FIELD_LABEL,
    SAVE_BUTTON,
} from '../lib/holdingStyles';
import { HoldingSymbolField } from './HoldingSymbolField';

interface HoldingFormProps {
    /** Present -> edit mode (symbol is fixed, read-only). Absent -> add mode (symbol picked via autocomplete). */
    initial?: PortfolioHoldingView;
    /**
     * 추가 모드의 시작 심볼. `/[symbol]/position`의 CTA에서 넘어온 사용자가
     * 보던 종목을 다시 입력하지 않게 한다. 편집 모드에서는 `initial`이
     * 우선한다 — 그쪽은 심볼이 읽기 전용이다.
     */
    defaultSymbol?: string;
    onSubmit: (input: RawHoldingInput) => Promise<SavePortfolioResult>;
    /** 부모가 아는 진행 중 신호(관심종목 전환의 저장 등). 폼은 자기 제출의 진행 중 상태도 따로 든다. */
    submitting?: boolean;
    onCancel?: () => void;
    /**
     * When true and in edit mode, focuses the quantity field once on mount.
     * Used by an inline row editor (e.g. `PortfolioSection`) so swapping a
     * row's display buttons for this form moves keyboard focus into the new
     * control instead of dropping it to `<body>`. The symbol field is
     * read-only in edit mode, so quantity is the first focusable input.
     */
    autoFocusFirstField?: boolean;
}

/** Controlled add/edit form for a single holding. In add mode, clears itself on success; in edit mode, calls onCancel on success to let the parent close the inline editor. */
export function HoldingForm({
    initial,
    defaultSymbol,
    onSubmit,
    submitting = false,
    onCancel,
    autoFocusFirstField = false,
}: HoldingFormProps) {
    const t = useTranslations('features.portfolio-management');
    const formId = useId();
    const form = useHoldingForm({
        initial,
        defaultSymbol,
        onSubmit,
        submitting,
        onCancel,
        autoFocusFirstField,
    });

    const errorId = `${formId}-error`;
    const idleSubmitLabel = form.isEditMode
        ? t('HoldingForm.1f1712')
        : t('HoldingForm.579429');
    const submitLabel = form.isSubmitting
        ? t('HoldingForm.9f6785')
        : idleSubmitLabel;

    return (
        <form
            onSubmit={form.handleSubmit}
            noValidate
            className="flex flex-col gap-3"
        >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <HoldingSymbolField
                    formId={formId}
                    errorId={errorId}
                    isEditMode={form.isEditMode}
                    symbol={form.symbol}
                    symbolName={form.symbolName}
                    isInvalid={form.errorField === 'symbol'}
                    containerRef={form.symbolFieldRef}
                    onSelect={form.selectSymbol}
                    onClear={form.clearSymbol}
                />
                <NumberField
                    id={`${formId}-quantity`}
                    name="quantity"
                    label={t('HoldingForm.7294d6')}
                    placeholder={t('HoldingForm.7c07f7')}
                    widthClassName="sm:w-28"
                    inputRef={form.quantityRef}
                    value={form.quantity}
                    onChange={form.changeQuantity}
                    isInvalid={form.errorField === 'quantity'}
                    errorId={errorId}
                />
                <NumberField
                    id={`${formId}-average-price`}
                    name="averagePrice"
                    label={t('HoldingForm.900beb')}
                    placeholder={t('HoldingForm.ca59e5')}
                    widthClassName="sm:w-32"
                    inputRef={form.priceRef}
                    value={form.averagePrice}
                    onChange={form.changeAveragePrice}
                    isInvalid={form.errorField === 'averagePrice'}
                    errorId={errorId}
                />
                <div className="flex shrink-0 items-center gap-1">
                    {/* 진행 중에도 포커스를 쥐도록 disabled 대신 aria-disabled로 막는다(REACT.md#AX-3).
                        중복 제출은 훅의 handleSubmit이 진행 중이면 돌려보내 막는다. */}
                    <button
                        type="submit"
                        aria-disabled={form.isSubmitting || undefined}
                        aria-busy={form.isSubmitting}
                        className={SAVE_BUTTON}
                    >
                        {submitLabel}
                    </button>
                    {onCancel && (
                        <button
                            type="button"
                            onClick={onCancel}
                            className={CANCEL_BUTTON}
                        >
                            {t('HoldingForm.19b2d1')}
                        </button>
                    )}
                </div>
            </div>
            <div id={errorId} role="alert" className="min-h-5 text-sm">
                {form.error && (
                    <span className="text-ui-danger-text">{form.error}</span>
                )}
            </div>
        </form>
    );
}

interface NumberFieldProps {
    id: string;
    name: keyof Omit<RawHoldingInput, 'symbol'>;
    label: string;
    placeholder: string;
    /** `sm` 이상에서 칸 폭. 모바일에서는 두 칸 모두 한 줄을 다 쓴다. */
    widthClassName: string;
    inputRef: React.Ref<HTMLInputElement>;
    value: string;
    onChange: (value: string) => void;
    isInvalid: boolean;
    errorId: string;
}

function NumberField({
    id,
    name,
    label,
    placeholder,
    widthClassName,
    inputRef,
    value,
    onChange,
    isInvalid,
    errorId,
}: NumberFieldProps) {
    return (
        <div className={cn('w-full', widthClassName)}>
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
                onChange={e => onChange(e.target.value)}
                aria-invalid={isInvalid}
                aria-describedby={isInvalid ? errorId : undefined}
                className={cn(FIELD_INPUT, isInvalid && FIELD_INPUT_ERROR)}
            />
        </div>
    );
}
