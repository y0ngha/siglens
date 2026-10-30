'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { stripNegativeSign } from '@/shared/lib/stripNegativeSign';
import { trimTrailingZeros } from '@/shared/lib/trimTrailingZeros';
import type {
    PortfolioHoldingView,
    RawHoldingInput,
    SavePortfolioResult,
} from '@/entities/portfolio/model';
import { focusHoldingErrorField } from '../lib/focusHoldingErrorField';
import {
    fieldForErrorCode,
    type HoldingErrorField,
} from '../lib/holdingErrorField';
import { resolveOrNull } from '../lib/resolveOrNull';

/** `useHoldingForm`의 입력. 각 필드의 의미는 `HoldingForm`의 props와 같다. */
export interface UseHoldingFormOptions {
    initial?: PortfolioHoldingView;
    defaultSymbol?: string;
    onSubmit: (input: RawHoldingInput) => Promise<SavePortfolioResult>;
    /** 부모가 아는 진행 중 신호. 폼 자신의 진행 중 상태와 OR로 합친다. */
    submitting: boolean;
    onCancel?: () => void;
    autoFocusFirstField: boolean;
}

/** 자동완성이 넘기는 선택 결과 중 폼이 쓰는 부분. */
export interface SelectedSymbol {
    symbol: string;
    label: string;
}

/** `useHoldingForm`이 `HoldingForm` 렌더에 넘기는 상태·핸들러. */
export interface UseHoldingFormResult {
    isEditMode: boolean;
    symbol: string;
    /** 칩을 `회사명 (티커)`로 그리기 위한 표시 전용 이름. 제출 페이로드에는 실리지 않는다. */
    symbolName: string | null;
    quantity: string;
    averagePrice: string;
    error: string | null;
    errorField: HoldingErrorField;
    isSubmitting: boolean;
    symbolFieldRef: React.RefObject<HTMLDivElement | null>;
    quantityRef: React.RefObject<HTMLInputElement | null>;
    priceRef: React.RefObject<HTMLInputElement | null>;
    selectSymbol: (entry: SelectedSymbol) => void;
    clearSymbol: () => void;
    changeQuantity: (value: string) => void;
    changeAveragePrice: (value: string) => void;
    handleSubmit: (e: React.SubmitEvent<HTMLFormElement>) => Promise<void>;
}

/**
 * 보유종목 한 건의 추가/편집 폼 상태. 추가 모드는 성공하면 스스로 비우고, 편집 모드는 성공하면
 * `onCancel`을 불러 부모가 인라인 편집기를 닫게 한다.
 *
 * 진행 중 상태를 폼이 직접 들고 있는 이유: 부모의 `submitting`은 같은 뮤테이션을 쓰는 다른
 * 폼(편집 행)이 열리면 꺼질 수 있다. 그 신호에만 기대면 아직 응답을 기다리는 폼의 버튼이 다시
 * 살아나 같은 저장이 두 번 나간다.
 */
export function useHoldingForm({
    initial,
    defaultSymbol,
    onSubmit,
    submitting,
    onCancel,
    autoFocusFirstField,
}: UseHoldingFormOptions): UseHoldingFormResult {
    const [symbol, setSymbol] = useState(
        initial?.symbol ?? defaultSymbol ?? ''
    );
    const [symbolName, setSymbolName] = useState<string | null>(
        initial?.companyName ?? null
    );
    const [quantity, setQuantity] = useState(
        initial ? trimTrailingZeros(initial.quantity) : ''
    );
    const [averagePrice, setAveragePrice] = useState(
        initial ? trimTrailingZeros(initial.averagePrice) : ''
    );
    const [error, setError] = useState<string | null>(null);
    const [errorField, setErrorField] = useState<HoldingErrorField>(null);
    const [isInFlight, setIsInFlight] = useState(false);

    const symbolFieldRef = useRef<HTMLDivElement>(null);
    const quantityRef = useRef<HTMLInputElement>(null);
    const priceRef = useRef<HTMLInputElement>(null);

    const t = useTranslations('features.portfolio-management');

    const selectSymbol = useCallback((entry: SelectedSymbol) => {
        setSymbol(entry.symbol);
        setSymbolName(entry.label);
    }, []);

    const clearSymbol = useCallback(() => {
        setSymbol('');
        setSymbolName(null);
    }, []);

    const changeQuantity = useCallback((value: string) => {
        setQuantity(stripNegativeSign(value));
    }, []);

    const changeAveragePrice = useCallback((value: string) => {
        setAveragePrice(stripNegativeSign(value));
    }, []);

    const isEditMode = initial !== undefined;
    const isSubmitting = submitting || isInFlight;

    // HK-1 예외: 위 파생값(`isSubmitting`, `isEditMode`)을 읽는 콜백이라 그 뒤에 둔다.
    const handleSubmit = useCallback(
        async (e: React.SubmitEvent<HTMLFormElement>) => {
            e.preventDefault();
            if (isSubmitting) return;
            setError(null);
            setErrorField(null);
            setIsInFlight(true);
            const result = await resolveOrNull(onSubmit, {
                symbol,
                quantity,
                averagePrice,
            });
            setIsInFlight(false);
            if (result === null) {
                setError(t('HoldingForm.ea9c99'));
                return;
            }
            if (result.status === 'error') {
                const field = fieldForErrorCode(result.code);
                setError(result.message);
                setErrorField(field);
                focusHoldingErrorField(field, {
                    symbolField: symbolFieldRef.current,
                    quantity: quantityRef.current,
                    averagePrice: priceRef.current,
                });
                return;
            }
            if (isEditMode) {
                onCancel?.();
                return;
            }
            setSymbol('');
            setSymbolName(null);
            setQuantity('');
            setAveragePrice('');
        },
        [
            isSubmitting,
            onSubmit,
            symbol,
            quantity,
            averagePrice,
            t,
            isEditMode,
            onCancel,
        ]
    );

    useEffect(() => {
        // 행이 편집 모드에 들어갈 때마다 부모가 이 폼을 새로 마운트하므로, 두 값은 인스턴스
        // 수명 동안 바뀌지 않고 포커스는 편집 진입마다 한 번만 옮겨진다. 편집 모드의 종목 칸은
        // 읽기 전용이라 수량이 첫 입력칸이다.
        if (autoFocusFirstField && isEditMode) {
            quantityRef.current?.focus();
        }
    }, [autoFocusFirstField, isEditMode]);

    return {
        isEditMode,
        symbol,
        symbolName,
        quantity,
        averagePrice,
        error,
        errorField,
        isSubmitting,
        symbolFieldRef,
        quantityRef,
        priceRef,
        selectSymbol,
        clearSymbol,
        changeQuantity,
        changeAveragePrice,
        handleSubmit,
    };
}
