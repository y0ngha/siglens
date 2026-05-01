import { cn } from '@/lib/cn';

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
    const errorId = `${id}-error`;
    const helperId = `${id}-helper`;
    return (
        <div className="space-y-2">
            <label
                htmlFor={id}
                className="text-secondary-200 block text-sm font-medium"
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
                    'border-secondary-700 bg-secondary-950 text-secondary-50 placeholder:text-secondary-500 focus-visible:border-primary-500 focus-visible:ring-primary-500/40 min-h-32 w-full resize-y rounded-md border px-4 py-3 text-sm leading-relaxed focus-visible:ring-2 focus-visible:outline-none',
                    error && 'border-ui-danger/60'
                )}
            />
            <p id={helperId} className="text-secondary-500 text-right text-xs">
                최대 {maxLength.toLocaleString('ko-KR')}자
            </p>
            {error ? (
                <div
                    id={errorId}
                    role="alert"
                    className="text-ui-danger flex items-start gap-1 text-sm"
                >
                    <span aria-hidden>⚠</span>
                    <span>{error}</span>
                </div>
            ) : null}
        </div>
    );
}
