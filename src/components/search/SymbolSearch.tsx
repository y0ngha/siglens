'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { cn } from '@/lib/cn';

type SymbolSearchSize = 'sm' | 'lg';

interface SymbolSearchProps {
    className?: string;
    size?: SymbolSearchSize;
}

export function SymbolSearch({ className, size = 'sm' }: SymbolSearchProps) {
    const router = useRouter();
    const [value, setValue] = useState('');

    const handleSubmit = () => {
        const trimmed = value.trim().toUpperCase();
        if (!trimmed) return;
        router.push(`/${trimmed}`);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') handleSubmit();
    };

    const inputClass = cn(
        'bg-secondary-800 border-secondary-700 text-secondary-100 placeholder-secondary-500 focus:border-primary-600 focus:ring-primary-600 rounded-lg border transition-colors outline-none focus:ring-1',
        size === 'lg'
            ? 'focus-glow w-full px-4 py-3 text-base sm:w-96'
            : 'px-3 py-2 text-sm'
    );

    const buttonClass = cn(
        'bg-primary-600 hover:bg-primary-700 rounded-lg font-semibold text-white transition-colors',
        size === 'lg' ? 'px-6 py-3 text-base' : 'px-4 py-2 text-sm'
    );

    return (
        <div className={cn('flex items-center gap-2', className)}>
            <input
                type="text"
                value={value}
                onChange={e => setValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="티커 입력 (예: AAPL)"
                className={inputClass}
            />
            <button
                type="button"
                onClick={handleSubmit}
                className={buttonClass}
            >
                검색
            </button>
        </div>
    );
}
