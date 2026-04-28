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
                aria-invalid={!!error}
                aria-describedby={error ? errorId : undefined}
                className="border-secondary-700 text-secondary-50 placeholder:text-secondary-500 h-12 w-full rounded-md border bg-slate-950 px-4 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 focus:outline-none"
            />
            {error ? (
                <p
                    id={errorId}
                    role="alert"
                    className="flex items-start gap-1 text-sm text-rose-400"
                >
                    <span aria-hidden>⚠</span>
                    <span>{error}</span>
                </p>
            ) : null}
        </div>
    );
}
