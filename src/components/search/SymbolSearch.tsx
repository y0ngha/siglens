'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { cn } from '@/lib/cn';

interface SymbolSearchProps {
    className?: string;
}

export function SymbolSearch({ className }: SymbolSearchProps) {
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

    return (
        <div className={cn('flex items-center gap-2', className)}>
            <input
                type="text"
                value={value}
                onChange={e => setValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="티커 입력 (예: AAPL)"
                className="bg-secondary-800 border-secondary-700 text-secondary-100 placeholder-secondary-500 focus:border-primary-600 focus:ring-primary-600 rounded border px-3 py-2 text-sm transition-colors outline-none focus:ring-1"
            />
            <button
                type="button"
                onClick={handleSubmit}
                className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
            >
                검색
            </button>
        </div>
    );
}
