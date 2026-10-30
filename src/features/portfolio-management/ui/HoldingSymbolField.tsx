'use client';

import { useTranslations } from 'next-intl';
import { TickerAutocomplete } from '@/features/ticker-search/ui/TickerAutocomplete';
import { cn } from '@/shared/lib/cn';
import { symbolLabel } from '@/shared/lib/symbolLabel';
import type { SelectedSymbol } from '../hooks/useHoldingForm';
import {
    FIELD_INPUT,
    FIELD_INPUT_ERROR,
    FIELD_LABEL,
    SYMBOL_CHIP,
} from '../lib/holdingStyles';

interface HoldingSymbolFieldProps {
    /** `HoldingForm`의 `useId()` 값. 라벨·보조 문구 id를 이 접두사로 만든다. */
    formId: string;
    /** 폼의 오류 영역 id. 이 칸이 오류로 지목됐을 때만 자동완성의 `aria-describedby`로 걸린다. */
    errorId: string;
    isEditMode: boolean;
    symbol: string;
    symbolName: string | null;
    isInvalid: boolean;
    /** 오류 포커스가 모드별 컨트롤을 찾을 수 있게 칸 전체를 감싸는 컨테이너에 붙는다. */
    containerRef: React.Ref<HTMLDivElement>;
    onSelect: (entry: SelectedSymbol) => void;
    onClear: () => void;
}

/**
 * `HoldingForm`의 종목 칸. 편집 모드는 읽기 전용 텍스트, 추가 모드는 고른 종목이 있으면 칩과
 * "변경" 버튼, 없으면 티커 자동완성이다. 보이는 "종목" 라벨은 세 모드 모두 위에 남는다.
 */
export function HoldingSymbolField({
    formId,
    containerRef,
    ...controlProps
}: HoldingSymbolFieldProps) {
    const t = useTranslations('features.portfolio-management');
    return (
        <div ref={containerRef} className="min-w-0 flex-1">
            <span id={`${formId}-symbol-label`} className={FIELD_LABEL}>
                {t('HoldingForm.dfa8d7')}
            </span>
            <SymbolFieldControl formId={formId} {...controlProps} />
        </div>
    );
}

type SymbolFieldControlProps = Omit<HoldingSymbolFieldProps, 'containerRef'>;

function SymbolFieldControl({
    formId,
    errorId,
    isEditMode,
    symbol,
    symbolName,
    isInvalid,
    onSelect,
    onClear,
}: SymbolFieldControlProps) {
    const t = useTranslations('features.portfolio-management');
    const labelId = `${formId}-symbol-label`;
    const searchSuffixId = `${formId}-symbol-search-suffix`;

    if (isEditMode) {
        return (
            <div
                aria-labelledby={labelId}
                className={cn(FIELD_INPUT, 'flex items-center font-semibold')}
            >
                <span className="truncate">
                    {symbolLabel(symbol, symbolName)}
                </span>
            </div>
        );
    }

    if (symbol) {
        return (
            <div className={cn(SYMBOL_CHIP, isInvalid && 'border-ui-danger')}>
                <span className="min-w-0 truncate text-sm font-semibold text-secondary-100">
                    {symbolLabel(symbol, symbolName)}
                </span>
                <button
                    type="button"
                    onClick={onClear}
                    className="-my-2 touch-manipulation rounded px-1 py-2 text-xs font-medium text-primary-400 transition-colors hover:text-primary-300 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                >
                    {t('HoldingForm.ce0109')}
                </button>
            </div>
        );
    }

    return (
        <>
            {/* 시각적으로 숨긴 보조 문구. 위의 보이는 "종목" 라벨과 ariaLabelledby로 합쳐 접근 가능한
                이름을 "종목 티커 검색"으로 유지한다 — e2e·스크린 리더가 이 이름으로 칸을 찾는다. */}
            <span id={searchSuffixId} className="sr-only">
                {t('HoldingForm.3407f9')}
            </span>
            <TickerAutocomplete
                size="sm"
                navigateOnSelect={false}
                onSelect={onSelect}
                inputClassName={cn(
                    'bg-secondary-950 h-10 rounded-lg placeholder-secondary-400 focus:ring-2',
                    isInvalid
                        ? FIELD_INPUT_ERROR
                        : 'focus:border-primary-500 focus:ring-primary-500/40'
                )}
                ariaInvalid={isInvalid}
                ariaDescribedby={isInvalid ? errorId : undefined}
                ariaLabelledby={`${labelId} ${searchSuffixId}`}
            />
        </>
    );
}
