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

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const trimmed = value.trim().toUpperCase();
        if (!trimmed) return;
        router.push(`/${trimmed}`);
    };

    const inputClass = cn(
        'bg-secondary-800 border-secondary-700 text-secondary-100 placeholder-secondary-500 focus:border-primary-600 focus:ring-primary-500 rounded-lg border transition-colors outline-none focus:ring-1',
        size === 'lg'
            ? 'focus-glow w-full px-4 py-3 text-base sm:w-96'
            : 'px-3 py-2 text-sm'
    );

    const buttonClass = cn(
        'bg-primary-600 hover:bg-primary-700 rounded-lg font-semibold text-white transition-colors',
        size === 'lg' ? 'px-6 py-3 text-base' : 'px-4 py-2 text-sm'
    );

    return (
        <form
            onSubmit={handleSubmit}
            className={cn('flex items-center gap-2', className)}
        >
            <input
                name="symbol"
                autoComplete="off"
                aria-label="종목 티커 검색"
                type="text"
                value={value}
                onChange={e => setValue(e.target.value)}
                placeholder="티커 입력 (예: AAPL)"
                className={inputClass}
            />
            <button type="submit" className={buttonClass}>
                검색
            </button>
        </form>
    );
}
