'use client';

import { useMemo, type ReactElement } from 'react';
import { cn } from '@/lib/cn';
import { useTabs } from './useTabs';
import type { TabItem } from './utils/tabIds';

interface TabsPillProps<T extends string> {
    tabs: readonly TabItem<T>[];
    activeTab: T;
    onChange: (tab: T) => void;
    ariaLabel: string;
    idPrefix?: string;
    withHomeEnd?: boolean;
    className?: string;
}

export function TabsPill<T extends string>({
    tabs,
    activeTab,
    onChange,
    ariaLabel,
    idPrefix,
    withHomeEnd = false,
    className,
}: TabsPillProps<T>): ReactElement {
    const values = useMemo((): readonly T[] => tabs.map(t => t.value), [tabs]);
    const { getTabProps } = useTabs({
        tabs: values,
        activeTab,
        onChange,
        idPrefix,
        withHomeEnd,
    });

    return (
        <div
            role="tablist"
            aria-label={ariaLabel}
            className={cn('flex flex-wrap gap-2', className)}
        >
            {tabs.map(tab => {
                const props = getTabProps(tab.value);
                return (
                    <button
                        key={tab.value}
                        type="button"
                        {...props}
                        className={cn(
                            'focus-visible:ring-primary-500 rounded-full px-4 py-1.5 text-xs font-medium transition-colors focus-visible:ring-1 focus-visible:outline-none',
                            props['aria-selected']
                                ? 'bg-primary-600 text-white'
                                : 'border-secondary-700 text-secondary-400 hover:text-secondary-200 border'
                        )}
                    >
                        {tab.label}
                    </button>
                );
            })}
        </div>
    );
}
