'use client';

import { cn } from '@/shared/lib/cn';
import { PRIVACY_PATH, TERMS_PATH } from '@/shared/lib/legal';
import Link from 'next/link';
import { useEffect, useId, useRef } from 'react';

interface ConsentCheckboxGroupProps {
    privacyChecked: boolean;
    tosChecked: boolean;
    onPrivacyChange: (checked: boolean) => void;
    onTosChange: (checked: boolean) => void;
    error?: string;
}

interface ConsentRowProps {
    id: string;
    label: string;
    href: string;
    detailLabel: string;
    checked: boolean;
    invalid: boolean;
    errorId?: string;
    onChange: (checked: boolean) => void;
}

function ExternalArrowIcon() {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 16 16"
            width="14"
            height="14"
            aria-hidden="true"
            className="ml-1 inline-block"
        >
            <path
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
                d="M6 4h6v6M11 5L4.5 11.5"
            />
        </svg>
    );
}

interface CheckboxBoxProps {
    checked: boolean;
    /** Omitted for individual consent items; used by the master checkbox to signal "some but not all checked". */
    indeterminate?: boolean;
    invalid: boolean;
    inputProps: React.InputHTMLAttributes<HTMLInputElement>;
}

function CheckboxBox({
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
                    'peer size-5 cursor-pointer appearance-none rounded-sm border bg-transparent transition-colors duration-100',
                    'focus-visible:ring-primary-400 focus-visible:ring-offset-secondary-950 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
                    invalid
                        ? 'border-ui-danger'
                        : 'border-secondary-500 hover:border-secondary-300',
                    checked || indeterminate
                        ? 'bg-primary-500 border-primary-500 hover:bg-primary-400'
                        : '',
                    'disabled:cursor-not-allowed disabled:opacity-50'
                )}
            />
            {checked && !indeterminate ? (
                <svg
                    aria-hidden="true"
                    viewBox="0 0 16 16"
                    className="text-secondary-50 pointer-events-none absolute inset-0 m-auto size-3"
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
                    className="text-secondary-50 pointer-events-none absolute inset-0 m-auto size-3"
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

function ConsentRow({
    id,
    label,
    href,
    detailLabel,
    checked,
    invalid,
    errorId,
    onChange,
}: ConsentRowProps) {
    return (
        <label
            htmlFor={id}
            className={cn(
                'group flex min-h-11 cursor-pointer flex-col gap-1 py-1 sm:flex-row sm:items-center sm:justify-between',
                'border-l pl-3 transition-colors duration-200',
                invalid
                    ? 'border-ui-danger'
                    : checked
                      ? 'border-primary-500'
                      : 'border-transparent'
            )}
        >
            <span className="flex min-w-0 items-center gap-2">
                <CheckboxBox
                    checked={checked}
                    invalid={invalid}
                    inputProps={{
                        id,
                        required: true,
                        'aria-required': true,
                        'aria-invalid': invalid ? true : undefined,
                        'aria-describedby': errorId,
                        onChange: e => onChange(e.target.checked),
                    }}
                />
                <span className="text-secondary-300 text-sm">
                    <span className="text-secondary-400 mr-1 text-xs">
                        (필수)
                    </span>
                    {label}
                </span>
            </span>
            <Link
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={detailLabel}
                onClick={e => e.stopPropagation()}
                className="text-secondary-400 hover:text-primary-400 focus-visible:ring-primary-400 focus-visible:ring-offset-secondary-950 inline-flex shrink-0 items-center rounded-sm px-1 text-xs transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
                자세히 보기
                <ExternalArrowIcon />
                <span className="sr-only">(새 탭에서 열림)</span>
            </Link>
        </label>
    );
}

export function ConsentCheckboxGroup({
    privacyChecked,
    tosChecked,
    onPrivacyChange,
    onTosChange,
    error,
}: ConsentCheckboxGroupProps) {
    const masterId = useId();
    const privacyId = useId();
    const tosId = useId();
    const errorId = useId();

    const allChecked = privacyChecked && tosChecked;
    const someChecked = privacyChecked || tosChecked;
    const indeterminate = someChecked && !allChecked;

    function handleMasterChange(next: boolean): void {
        onPrivacyChange(next);
        onTosChange(next);
    }

    return (
        <fieldset className="border-secondary-800 touch-manipulation space-y-3 border-y py-4 [-webkit-tap-highlight-color:transparent]">
            <legend className="sr-only">동의 항목</legend>
            <p className="text-secondary-400 text-xs">
                계속하려면 아래 항목에 동의해주세요.
            </p>
            <label
                htmlFor={masterId}
                className="flex min-h-11 cursor-pointer items-center gap-2 py-1"
            >
                <CheckboxBox
                    checked={allChecked}
                    indeterminate={indeterminate}
                    invalid={false}
                    inputProps={{
                        id: masterId,
                        onChange: e => handleMasterChange(e.target.checked),
                        'aria-controls': `${privacyId} ${tosId}`,
                    }}
                />
                <span className="text-secondary-100 text-sm font-semibold">
                    모두 동의
                </span>
            </label>
            <div
                role="separator"
                aria-hidden="true"
                className="border-secondary-800 border-t"
            />
            <ConsentRow
                id={privacyId}
                label="개인정보 수집·이용 동의"
                href={PRIVACY_PATH}
                detailLabel="개인정보처리방침 자세히 보기"
                checked={privacyChecked}
                invalid={Boolean(error) && !privacyChecked}
                errorId={error ? errorId : undefined}
                onChange={onPrivacyChange}
            />
            <ConsentRow
                id={tosId}
                label="서비스 이용약관 동의"
                href={TERMS_PATH}
                detailLabel="이용약관 자세히 보기"
                checked={tosChecked}
                invalid={Boolean(error) && !tosChecked}
                errorId={error ? errorId : undefined}
                onChange={onTosChange}
            />
            {error ? (
                <p
                    id={errorId}
                    role="status"
                    aria-live="polite"
                    className="text-ui-danger text-xs"
                >
                    {error}
                </p>
            ) : null}
        </fieldset>
    );
}
