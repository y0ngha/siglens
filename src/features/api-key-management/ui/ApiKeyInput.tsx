'use client';

import { EyeIcon } from '@/shared/ui/EyeIcon';
import { useState } from 'react';

interface ApiKeyInputProps {
    name: string;
    placeholder?: string;
    'aria-label'?: string;
    'aria-describedby'?: string;
}

export function ApiKeyInput({
    name,
    placeholder,
    'aria-label': ariaLabel,
    'aria-describedby': ariaDescribedby,
}: ApiKeyInputProps) {
    const [visible, setVisible] = useState(false);

    return (
        <div className="relative min-w-0 flex-1">
            <input
                type={visible ? 'text' : 'password'}
                name={name}
                required
                autoComplete="new-password"
                placeholder={placeholder}
                aria-label={ariaLabel}
                aria-describedby={ariaDescribedby}
                className="h-10 w-full rounded-lg border border-secondary-700 bg-secondary-950 px-3 pr-10 font-mono text-sm text-secondary-50 placeholder:text-secondary-500 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/40 focus:outline-none"
            />
            <button
                type="button"
                onClick={() => setVisible(v => !v)}
                aria-label={visible ? 'API 키 숨기기' : 'API 키 보이기'}
                aria-pressed={visible}
                className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-secondary-400 hover:text-secondary-200 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1 focus-visible:ring-offset-secondary-950 focus-visible:outline-none"
            >
                <EyeIcon isVisible={visible} className="h-4 w-4" />
            </button>
        </div>
    );
}
