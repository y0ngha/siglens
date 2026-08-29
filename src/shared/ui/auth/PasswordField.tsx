'use client';

import { useTranslations } from 'next-intl';
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
    const t = useTranslations('shared.ui');
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
                className="block text-sm font-medium text-secondary-200"
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
                    className="h-12 w-full rounded-lg border border-border-control bg-secondary-950 px-4 pr-12 text-sm text-secondary-50 placeholder:text-secondary-500 focus:border-primary-500 focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
                <button
                    type="button"
                    onClick={() => setVisible(v => !v)}
                    aria-label={
                        visible
                            ? t('PasswordField.483994')
                            : t('PasswordField.49d3b5')
                    }
                    aria-pressed={visible}
                    className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-lg text-secondary-400 hover:text-secondary-200 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-secondary-950 focus-visible:outline-none"
                >
                    <EyeIcon isVisible={visible} className="h-5 w-5" />
                </button>
            </div>
            {capsLock ? (
                <p
                    id={capsId}
                    aria-live="polite"
                    className="text-xs text-ui-warning-text"
                >
                    {t('PasswordField.3ddfb5')}
                </p>
            ) : null}
            {hint}
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
