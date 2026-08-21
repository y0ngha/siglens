'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/shared/lib/cn';
import { PRIVACY_PATH, TERMS_PATH } from '@/shared/lib/legal';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
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
    const t = useTranslations('shared.ui');
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
                <span className="text-sm text-secondary-300">
                    <span className="mr-1 text-xs text-secondary-400">
                        {t('ConsentCheckboxGroup.d3e427')}
                    </span>
                    {label}
                </span>
            </span>
            <Link
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                // `/privacy`·`/terms`로 가는 링크 — 회원가입·OAuth 동의 화면마다 렌더된다.
                // `_rsc` 해시가 진입 경로마다 달라 캐시가 파편화되므로 prefetch를 끈다
                // (docs/architecture/CDN_CACHING.md §1). `target="_blank"`라 어차피 새 탭
                // 문서 요청으로 열리고, prefetch한 RSC 페이로드는 쓰이지도 않는다.
                prefetch={false}
                aria-label={detailLabel}
                onClick={e => e.stopPropagation()}
                className="inline-flex shrink-0 items-center rounded-sm px-1 text-xs text-secondary-400 transition-colors hover:text-primary-400 focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-secondary-950 focus-visible:outline-none"
            >
                {t('ConsentCheckboxGroup.918f5d')}
                <ExternalArrowIcon />
                <span className="sr-only">
                    {t('ConsentCheckboxGroup.f97073')}
                </span>
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
    const t = useTranslations('shared.ui');
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
        <fieldset className="touch-manipulation space-y-3 border-y border-secondary-800 py-4 [-webkit-tap-highlight-color:transparent]">
            <legend className="sr-only">
                {t('ConsentCheckboxGroup.1f835a')}
            </legend>
            <p className="text-xs text-secondary-400">
                {t('ConsentCheckboxGroup.c99227')}
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
                <span className="text-sm font-semibold text-secondary-100">
                    {t('ConsentCheckboxGroup.847c16')}
                </span>
            </label>
            <div
                role="separator"
                aria-hidden="true"
                className="border-t border-secondary-800"
            />
            <ConsentRow
                id={privacyId}
                label={t('ConsentCheckboxGroup.f1bf9f')}
                href={PRIVACY_PATH}
                detailLabel={t('ConsentCheckboxGroup.4eafc4')}
                checked={privacyChecked}
                invalid={Boolean(error) && !privacyChecked}
                errorId={error ? errorId : undefined}
                onChange={onPrivacyChange}
            />
            <ConsentRow
                id={tosId}
                label={t('ConsentCheckboxGroup.4f0847')}
                href={TERMS_PATH}
                detailLabel={t('ConsentCheckboxGroup.337a9a')}
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
                    className="text-xs text-ui-danger"
                >
                    {error}
                </p>
            ) : null}
        </fieldset>
    );
}
