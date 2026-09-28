'use client';

import {
    useEffect,
    useEffectEvent,
    useRef,
    type KeyboardEvent,
    type Ref,
} from 'react';
import type { ModelId } from '@y0ngha/siglens-core';
import { cn } from '@/shared/lib/cn';
import { getModelDisplay } from '@/shared/lib/modelDisplay';
import { ModelAccessBadge } from '@/shared/ui/ModelAccessBadge';

interface ModelListboxProps {
    /** 바깥 클릭 판정(`usePopoverToggle`)에 쓰도록 패널 요소를 넘긴다. */
    ref: Ref<HTMLDivElement>;
    models: readonly ModelId[];
    selected: ModelId;
    onChange: (model: ModelId) => void;
    /** 목록을 닫고 포커스를 트리거로 돌려준다 — 선택·Escape 둘 다 이걸 부른다. */
    onClose: () => void;
    ariaLabel: string;
    /** 패널 위치(방향·정렬·폭). 테두리·배경 같은 표면은 여기서 고정한다. */
    className: string;
}

/**
 * AI 모델 listbox 패널 — 분석 설정의 `ModelSelector`와 챗 패널의 `ModelSelect`가
 * 트리거만 다르고 이 목록을 공유한다.
 *
 * WAI-ARIA listbox: 선택된 옵션만 `tabIndex=0`(roving), ↑/↓(순환)·Home/End로
 * 선택과 DOM 포커스를 함께 옮기고, Enter/Space/클릭은 선택 후 닫는다.
 * 열리면(마운트) 선택된 옵션으로 포커스를 옮긴다.
 *
 * Escape는 전파를 끊는다 — 설정 팝오버처럼 바깥에도 문서 레벨 Escape 리스너가
 * 있으면, 가장 안쪽 층(이 목록)만 닫혀야 한다.
 */
export function ModelListbox({
    ref,
    models,
    selected,
    onChange,
    onClose,
    ariaLabel,
    className,
}: ModelListboxProps) {
    const optionRefs = useRef<(HTMLDivElement | null)[]>([]);

    // 열릴 때(마운트) 한 번만 — 이후 포커스는 키 핸들러가 옮긴다.
    const focusSelected = useEffectEvent(() => {
        optionRefs.current[models.indexOf(selected)]?.focus();
    });
    useEffect(() => {
        focusSelected();
    }, []);

    const moveTo = (index: number): void => {
        onChange(models[index]!);
        optionRefs.current[index]?.focus();
    };

    const choose = (model: ModelId): void => {
        onChange(model);
        onClose();
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
        const current = models.indexOf(selected);
        const count = models.length;
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                moveTo((current + 1) % count);
                break;
            case 'ArrowUp':
                e.preventDefault();
                moveTo((current - 1 + count) % count);
                break;
            case 'Home':
                e.preventDefault();
                moveTo(0);
                break;
            case 'End':
                e.preventDefault();
                moveTo(count - 1);
                break;
            case 'Escape':
                e.preventDefault();
                e.stopPropagation();
                onClose();
                break;
        }
    };

    return (
        <div
            ref={ref}
            role="listbox"
            aria-label={ariaLabel}
            // listbox는 인터랙티브 role이라 포커스 가능해야 한다.
            // -1이므로 탭 순서는 그대로(트리거 버튼만 탭 대상).
            tabIndex={-1}
            onKeyDown={handleKeyDown}
            className={cn(
                'border-secondary-600 bg-secondary-800 absolute z-10 rounded-lg border shadow-lg',
                className
            )}
        >
            <div className="max-h-66 overflow-y-auto overscroll-contain">
                {models.map((model, i) => {
                    const display = getModelDisplay(model);
                    const isSelected = model === selected;
                    return (
                        <div
                            key={model}
                            ref={el => {
                                optionRefs.current[i] = el;
                            }}
                            role="option"
                            tabIndex={isSelected ? 0 : -1}
                            aria-selected={isSelected}
                            onClick={() => choose(model)}
                            onKeyDown={e => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    choose(model);
                                }
                            }}
                            className={cn(
                                'focus-visible:ring-primary-500 flex min-h-11 w-full cursor-pointer items-center gap-2 px-3 transition-colors focus-visible:ring-1 focus-visible:outline-none',
                                isSelected
                                    ? 'text-primary-300 bg-primary-900/20'
                                    : 'text-secondary-300 hover:bg-secondary-700'
                            )}
                        >
                            <span className="w-3 text-[10px]">
                                {isSelected && '✓'}
                            </span>
                            <div className="flex flex-1 items-center justify-between gap-2">
                                <div>
                                    <div className="text-[11px] font-medium">
                                        {display.label}
                                    </div>
                                    <div className="text-[10px] text-secondary-500">
                                        {display.fullName}
                                    </div>
                                </div>
                                <ModelAccessBadge model={model} />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
