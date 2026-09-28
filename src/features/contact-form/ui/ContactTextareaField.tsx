import { useTranslations } from 'next-intl';
import { cn } from '@/shared/lib/cn';
import { INTL_LOCALE } from '@/shared/i18n/locales';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';

interface ContactTextareaFieldProps {
    id: string;
    name: string;
    label: string;
    required?: boolean;
    maxLength: number;
    rows?: number;
    defaultValue?: string;
    placeholder?: string;
    error?: string;
}

export function ContactTextareaField({
    id,
    name,
    label,
    required,
    maxLength,
    rows = 6,
    defaultValue,
    placeholder,
    error,
}: ContactTextareaFieldProps) {
    const t = useTranslations('features.contact-form');
    const locale = useResolvedLocale();
    const errorId = `${id}-error`;
    const helperId = `${id}-helper`;
    return (
        <div className="space-y-2">
            <label
                htmlFor={id}
                className="block text-sm font-medium text-secondary-200"
            >
                {label}
            </label>
            <textarea
                id={id}
                name={name}
                required={required}
                maxLength={maxLength}
                rows={rows}
                defaultValue={defaultValue}
                placeholder={placeholder}
                aria-invalid={Boolean(error)}
                aria-describedby={[error && errorId, helperId]
                    .filter(Boolean)
                    .join(' ')}
                className={cn(
                    'border-border-control bg-secondary-950 text-secondary-50 placeholder:text-secondary-500 focus-visible:border-primary-500 focus-visible:ring-primary-500/40 min-h-32 w-full resize-y rounded-lg border px-4 py-3 text-sm leading-relaxed focus-visible:ring-2 focus-visible:outline-none',
                    error && 'border-ui-danger'
                )}
            />
            <p id={helperId} className="text-right text-xs text-secondary-500">
                {t('ContactTextareaField.fbccd7', {
                    // 자릿수 구분은 현재 로케일을 따른다 — 예전엔 'ko-KR' 고정이었다.
                    v0: maxLength.toLocaleString(INTL_LOCALE[locale]),
                })}
            </p>
            {error ? (
                <div
                    id={errorId}
                    role="alert"
                    className="flex items-start gap-1 text-sm text-ui-danger-text"
                >
                    <span aria-hidden>⚠</span>
                    <span>{error}</span>
                </div>
            ) : null}
        </div>
    );
}
