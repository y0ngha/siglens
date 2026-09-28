interface TextFieldProps {
    id: string;
    name: string;
    label: string;
    type: 'email' | 'text';
    autoComplete?: string;
    required?: boolean;
    maxLength?: number;
    defaultValue?: string;
    value?: string;
    placeholder?: string;
    error?: string;
    onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

/** 라벨·입력·오류 문구 한 벌. 비밀번호는 보기 토글·Caps Lock 안내가 있는 `PasswordField`. */
export function TextField({
    id,
    name,
    label,
    type,
    autoComplete,
    required,
    maxLength,
    defaultValue,
    value,
    placeholder,
    error,
    onChange,
}: TextFieldProps) {
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
                {...(value !== undefined ? { value } : {})}
                placeholder={placeholder}
                onChange={onChange}
                aria-invalid={!!error}
                aria-describedby={error ? errorId : undefined}
                className="h-12 w-full rounded-lg border border-border-control bg-secondary-950 px-4 text-sm text-secondary-50 placeholder:text-secondary-500 focus:border-primary-500 focus:ring-2 focus:ring-primary-500 focus:outline-none aria-invalid:border-ui-danger"
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
