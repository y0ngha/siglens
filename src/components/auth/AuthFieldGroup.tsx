interface AuthFieldGroupProps {
    id: string;
    name: string;
    label: string;
    type: 'email' | 'text';
    autoComplete?: string;
    required?: boolean;
    defaultValue?: string;
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
    placeholder,
    error,
    onChange,
}: AuthFieldGroupProps) {
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
                required={required}
                defaultValue={defaultValue}
                placeholder={placeholder}
                onChange={onChange}
                aria-invalid={!!error}
                aria-describedby={error ? errorId : undefined}
                className="border-secondary-700 bg-secondary-950 text-secondary-50 placeholder:text-secondary-500 focus:border-primary-500 focus:ring-primary-500/40 h-12 w-full rounded-md border px-4 text-sm focus:ring-2 focus:outline-none"
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
