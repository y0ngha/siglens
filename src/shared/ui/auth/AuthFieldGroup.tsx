interface AuthFieldGroupProps {
    id: string;
    name: string;
    label: string;
    type: 'email' | 'text';
    autoComplete?: string;
    required?: boolean;
    defaultValue?: string;
    value?: string;
    placeholder?: string;
    error?: string;
    onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export function AuthFieldGroup({
    id,
    name,
    label,
    type,
    autoComplete,
    required,
    defaultValue,
    value,
    placeholder,
    error,
    onChange,
}: AuthFieldGroupProps) {
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
                defaultValue={defaultValue}
                {...(value !== undefined ? { value } : {})}
                placeholder={placeholder}
                onChange={onChange}
                aria-invalid={!!error}
                aria-describedby={error ? errorId : undefined}
                className="h-12 w-full rounded-lg border border-border-control bg-secondary-950 px-4 text-sm text-secondary-50 placeholder:text-secondary-500 focus:border-primary-500 focus:ring-2 focus:ring-primary-500 focus:outline-none"
            />
            {error ? (
                <p
                    id={errorId}
                    role="alert"
                    className="flex items-start gap-1 text-sm text-ui-danger-text"
                >
                    <span aria-hidden>⚠</span>
                    <span>{error}</span>
                </p>
            ) : null}
        </div>
    );
}
