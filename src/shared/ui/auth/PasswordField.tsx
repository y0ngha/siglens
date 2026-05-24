'use client';

import { EyeIcon } from '@/shared/ui/EyeIcon';
import { useState, type ReactNode } from 'react';

interface PasswordFieldProps {
    id: string;
    name: string;
    label: string;
    autoComplete: 'current-password' | 'new-password';
    required?: boolean;
    value?: string;
    error?: string;
    hint?: ReactNode;
    describedById?: string;
    onChange?: (value: string) => void;
}

export function PasswordField({
    id,
    name,
    label,
    autoComplete,
    required,
    value,
    error,
    hint,
    describedById,
    onChange,
}: PasswordFieldProps) {
    const [visible, setVisible] = useState(false);
    const [capsLock, setCapsLock] = useState(false);
    const errorId = `${id}-error`;
    const capsId = `${id}-caps`;
    const describedByParts = [
        error ? errorId : null,
        capsLock ? capsId : null,
        describedById ?? null,
    ].filter((part): part is string => part !== null);
    const describedBy =
        describedByParts.length > 0 ? describedByParts.join(' ') : undefined;
    return (
        <div className="space-y-2">
            <label
                htmlFor={id}
                className="text-secondary-200 block text-sm font-medium"
            >
                {label}
            </label>
            <div className="relative">
                <input
                    id={id}
                    name={name}
                    type={visible ? 'text' : 'password'}
                    autoComplete={autoComplete}
                    required={required}
                    {...(value !== undefined ? { value } : {})}
                    onChange={e => onChange?.(e.target.value)}
                    onKeyUp={e => setCapsLock(e.getModifierState('CapsLock'))}
                    onBlur={() => setCapsLock(false)}
                    aria-invalid={!!error}
                    aria-describedby={describedBy}
                    className="border-secondary-700 bg-secondary-950 text-secondary-50 placeholder:text-secondary-500 focus:border-primary-500 focus:ring-primary-500/40 h-12 w-full rounded-md border px-4 pr-12 text-sm focus:ring-2 focus:outline-none"
                />
                <button
                    type="button"
                    onClick={() => setVisible(v => !v)}
                    aria-label={visible ? '비밀번호 숨기기' : '비밀번호 보이기'}
                    aria-pressed={visible}
                    className="text-secondary-400 hover:text-secondary-200 focus-visible:ring-primary-500 focus-visible:ring-offset-secondary-950 absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-md focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                    <EyeIcon isVisible={visible} className="h-5 w-5" />
                </button>
            </div>
            {capsLock ? (
                <p
                    id={capsId}
                    aria-live="polite"
                    className="text-ui-warning text-xs"
                >
                    Caps Lock이 켜져 있습니다.
                </p>
            ) : null}
            {hint}
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
