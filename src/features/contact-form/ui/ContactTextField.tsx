import { cn } from '@/shared/lib/cn';

type ContactInputType = 'text' | 'email';

interface ContactTextFieldProps {
    id: string;
    name: string;
    label: string;
    type: ContactInputType;
    autoComplete?: string;
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
                className="block text-sm font-medium text-secondary-200"
            >
                {label}
            </label>
            <input
                id={id}
                name={name}
                type={type}
                autoComplete={autoComplete}
                required={required}
                maxLength={maxLength}
                defaultValue={defaultValue}
                placeholder={placeholder}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? errorId : undefined}
                className={cn(
                    'border-border-control bg-secondary-950 text-secondary-50 placeholder:text-secondary-500 focus-visible:border-primary-500 focus-visible:ring-primary-500/40 h-12 w-full rounded-lg border px-4 text-sm focus-visible:ring-2 focus-visible:outline-none',
                    error && 'border-ui-danger'
                )}
            />
            {error ? (
                <div
                    id={errorId}
                    role="alert"
                    className="flex items-start gap-1 text-sm text-ui-danger"
                >
                    <span aria-hidden>⚠</span>
                    <span>{error}</span>
                </div>
            ) : null}
        </div>
    );
}
