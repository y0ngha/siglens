'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/shared/lib/cn';

interface CheckboxBoxProps {
    checked: boolean;
    /** 개별 동의 항목에서는 생략한다. 마스터 체크박스가 "일부만 체크됨"을 나타낼 때만 쓴다. */
    indeterminate?: boolean;
    invalid: boolean;
    inputProps: React.InputHTMLAttributes<HTMLInputElement>;
}

/**
 * 약관 동의·선택 동의 행이 함께 쓰는 체크박스. 네이티브 `input`을 `appearance-none`으로 그리고
 * 체크·일부 선택 표시는 SVG로 덧그린다.
 */
export function CheckboxBox({
    checked,
    indeterminate,
    invalid,
    inputProps,
}: CheckboxBoxProps) {
    const ref = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        if (ref.current) {
            ref.current.indeterminate = indeterminate ?? false;
        }
    }, [indeterminate]);

    return (
        <span className="relative inline-flex shrink-0">
            <input
                ref={ref}
                type="checkbox"
                checked={checked}
                {...inputProps}
                className={cn(
                    'peer size-5 cursor-pointer appearance-none rounded border bg-transparent transition-colors duration-100',
                    'focus-visible:ring-primary-400 focus-visible:ring-offset-secondary-950 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
                    invalid
                        ? 'border-ui-danger'
                        : 'border-secondary-500 hover:border-secondary-300',
                    checked || indeterminate
                        ? 'bg-primary-500 border-primary-500 hover:bg-primary-400'
                        : '',
                    'disabled:cursor-not-allowed disabled:border-border-control'
                )}
            />
            {checked && !indeterminate ? (
                <svg
                    aria-hidden="true"
                    viewBox="0 0 16 16"
                    className="pointer-events-none absolute inset-0 m-auto size-3 text-secondary-50"
                >
                    <path
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3.5 8.5L6.5 11.5L12.5 5.5"
                    />
                </svg>
            ) : null}
            {indeterminate ? (
                <svg
                    aria-hidden="true"
                    viewBox="0 0 16 16"
                    className="pointer-events-none absolute inset-0 m-auto size-3 text-secondary-50"
                >
                    <path
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        d="M4 8H12"
                    />
                </svg>
            ) : null}
        </span>
    );
}
