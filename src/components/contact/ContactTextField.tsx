import { cn } from '@/lib/cn';

interface ContactTextFieldProps {
    id: string;
    name: string;
    label: string;
    type: 'text' | 'email';
    autoComplete?: string;
    autoFocus?: boolean;
    required?: boolean;
    maxLength?: number;
    defaultValue?: string;
    placeholder?: string;
    error?: string;
}

export function ContactTextField({
    id,
    name,
    label,
    type,
    autoComplete,
    autoFocus,
    required,
    maxLength,
    defaultValue,
    placeholder,
    error,
}: ContactTextFieldProps) {
    const errorId = `${id}-error`;
    return (
        <div className="space-y-2">
            <label
                htmlFor={id}
                className="text-secondary-200 block text-sm font-medium"
            >
                {label}
            </label>
            <input
                id={id}
                name={name}
                type={type}
                autoComplete={autoComplete}
                autoFocus={autoFocus}
                required={required}
                maxLength={maxLength}
                defaultValue={defaultValue}
                placeholder={placeholder}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? errorId : undefined}
                className={cn(
                    'border-secondary-700 bg-secondary-950 text-secondary-50 placeholder:text-secondary-500 focus:border-primary-500 focus:ring-primary-500/40 h-12 w-full rounded-md border px-4 text-sm focus:ring-2 focus:outline-none',
                    error && 'border-ui-danger/60'
                )}
            />
            {error ? (
                <p
                    id={errorId}
                    role="alert"
                    className="text-ui-danger flex items-start gap-1 text-sm"
                >
                    <span aria-hidden>⚠</span>
                    <span>{error}</span>
                </p>
            ) : null}
        </div>
    );
}
