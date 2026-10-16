'use client';

import {
    useEffect,
    useEffectEvent,
    useId,
    useRef,
    type KeyboardEvent,
    type Ref,
} from 'react';
import type { ModelId } from '@y0ngha/siglens-core';
import { cn } from '@/shared/lib/cn';
import { getModelDisplay } from '@/shared/lib/modelDisplay';
import { ModelAccessBadge } from '@/shared/ui/ModelAccessBadge';

export interface ModelListboxGroup {
    /** 그룹 머리글(예: provider 이름). */
    label: string;
    models: readonly ModelId[];
}

/** 목록의 맨 앞에 붙는 "모델 아님" 선택지(예: "설정 안 함"). */
export interface ModelListboxNone {
    label: string;
    /** 이 항목을 고르거나(클릭·Enter·Space) 키보드로 옮겨 앉았을 때 부른다. */
    onSelect: () => void;
}

interface ModelListboxProps {
    /** 평평한 목록. `groups`를 주면 무시된다. */
    models?: readonly ModelId[];
    /** 머리글이 붙은 묶음. 화면·키보드 순서는 이 배열 순서를 따른다. */
    groups?: readonly ModelListboxGroup[];
    /** 바깥 클릭 판정(`usePopoverToggle`)에 쓰도록 패널 요소를 넘긴다. */
    ref: Ref<HTMLDivElement>;
    /** `null`은 `none` 항목이 선택된 상태다(`none`이 있을 때만 의미가 있다). */
    selected: ModelId | null;
    onChange: (model: ModelId) => void;
    /**
     * 모델이 아닌 첫 항목. 없으면 기존처럼 모델만 나온다. 방향키·Home/End 순환에도 포함된다.
     */
    none?: ModelListboxNone;
    /** 목록을 닫고 포커스를 트리거로 돌려준다 — 선택·Escape 둘 다 이걸 부른다. */
    onClose: () => void;
    ariaLabel: string;
    /** 패널 위치(방향·정렬·폭). 테두리·배경 같은 표면은 여기서 고정한다. */
    className: string;
    /**
     * `false`면 모델 옆 등급 배지(MEMBER·BYOK)를 숨긴다. 기본 `true`.
     * 공개 API 기본 모델처럼 등급과 상관없이 모두 내 키로 도는 목록에서는 배지가 오해를 부른다.
     */
    showAccessBadge?: boolean;
}

/**
 * AI 모델 listbox 패널 — 분석 설정의 `ModelSelector`와 챗 패널의 `ModelSelect`가
 * 트리거만 다르고 이 목록을 공유한다.
 *
 * WAI-ARIA listbox: 선택된 옵션만 `tabIndex=0`(roving), ↑/↓(순환)·Home/End로
 * 선택과 DOM 포커스를 함께 옮기고, Enter/Space/클릭은 선택 후 닫는다.
 * 열리면(마운트) 선택된 옵션으로 포커스를 옮긴다.
 *
 * `none`을 주면 모델이 아닌 첫 항목("설정 안 함")이 생기고, `groups`를 주면 provider 같은
 * 머리글(`role="group"`) 아래로 묶인다 — 둘 다 선택이라 기존 호출부는 그대로다.
 *
 * Escape는 전파를 끊는다 — 설정 팝오버처럼 바깥에도 문서 레벨 Escape 리스너가
 * 있으면, 가장 안쪽 층(이 목록)만 닫혀야 한다.
 */
export function ModelListbox({
    ref,
    models,
    groups,
    selected,
    onChange,
    none,
    onClose,
    ariaLabel,
    className,
    showAccessBadge = true,
}: ModelListboxProps) {
    const optionRefs = useRef<(HTMLDivElement | null)[]>([]);
    const headingIdBase = useId();

    const sections: readonly {
        key: string;
        label: string | null;
        models: readonly ModelId[];
    }[] = groups
        ? groups.map(group => ({
              key: group.label,
              label: group.label,
              models: group.models,
          }))
        : [{ key: '', label: null, models: models ?? [] }];

    // 키보드 순서 = 화면 순서: (있으면) 모델 아님 항목, 그다음 그룹 순서대로 모델.
    const entries: readonly (ModelId | null)[] = [
        ...(none ? [null] : []),
        ...sections.flatMap(section => section.models),
    ];

    // 열릴 때(마운트) 한 번만 — 이후 포커스는 키 핸들러가 옮긴다.
    const focusSelected = useEffectEvent(() => {
        optionRefs.current[entries.indexOf(selected)]?.focus();
    });
    useEffect(() => {
        focusSelected();
    }, []);

    const select = (entry: ModelId | null): void => {
        if (entry === null) none?.onSelect();
        else onChange(entry);
    };

    const moveTo = (index: number): void => {
        select(entries[index]!);
        optionRefs.current[index]?.focus();
    };

    const choose = (entry: ModelId | null): void => {
        select(entry);
        onClose();
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
        const current = entries.indexOf(selected);
        const count = entries.length;
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

    const optionClass = (isSelected: boolean): string =>
        cn(
            'focus-visible:ring-primary-500 flex min-h-11 w-full cursor-pointer items-center gap-2 px-3 transition-colors focus-visible:ring-1 focus-visible:outline-none',
            isSelected
                ? 'text-primary-300 bg-primary-900/20'
                : 'text-secondary-300 hover:bg-secondary-700'
        );

    const optionProps = (entry: ModelId | null) => {
        const isSelected = entry === selected;
        return {
            role: 'option' as const,
            tabIndex: isSelected ? 0 : -1,
            'aria-selected': isSelected,
            onClick: () => choose(entry),
            onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    choose(entry);
                }
            },
            className: optionClass(isSelected),
        };
    };

    const renderModel = (model: ModelId) => {
        const display = getModelDisplay(model);
        const index = entries.indexOf(model);
        const isSelected = model === selected;
        return (
            <div
                key={model}
                ref={el => {
                    optionRefs.current[index] = el;
                }}
                {...optionProps(model)}
            >
                <span className="w-3 text-[10px]">{isSelected && '✓'}</span>
                <div className="flex flex-1 items-center justify-between gap-2">
                    <div>
                        <div className="text-[11px] font-medium">
                            {display.label}
                        </div>
                        <div className="text-[10px] text-secondary-500">
                            {display.fullName}
                        </div>
                    </div>
                    {showAccessBadge && <ModelAccessBadge model={model} />}
                </div>
            </div>
        );
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
                {none && (
                    <div
                        ref={el => {
                            optionRefs.current[0] = el;
                        }}
                        {...optionProps(null)}
                    >
                        <span className="w-3 text-[10px]">
                            {selected === null && '✓'}
                        </span>
                        <span className="text-[11px] font-medium">
                            {none.label}
                        </span>
                    </div>
                )}
                {sections.map((section, sectionIndex) =>
                    section.label === null ? (
                        section.models.map(renderModel)
                    ) : (
                        <div
                            key={section.key}
                            role="group"
                            aria-labelledby={`${headingIdBase}-${sectionIndex}`}
                        >
                            <div
                                id={`${headingIdBase}-${sectionIndex}`}
                                className="px-3 pt-2 pb-1 text-[10px] font-semibold tracking-wide text-secondary-400"
                            >
                                {section.label}
                            </div>
                            {section.models.map(renderModel)}
                        </div>
                    )
                )}
            </div>
        </div>
    );
}
