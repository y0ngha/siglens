'use client';

import { cn } from '@/shared/lib/cn';
import { useTabs, type TabPanelMounting } from '@/shared/ui/tabs/hooks/useTabs';
import type { TabItem } from '@/shared/ui/tabs/utils/tabIds';

interface TabsPillProps<T extends string> {
    tabs: readonly TabItem<T>[];
    activeTab: T;
    onChange: (tab: T) => void;
    ariaLabel: string;
    idPrefix?: string;
    withHomeEnd?: boolean;
    className?: string;
    /** 비활성 패널을 마운트하지 않는 소비자는 `'active'`를 넘긴다 — `useTabs` 참고. */
    panelMounting?: TabPanelMounting;
}

export function TabsPill<T extends string>({
    tabs,
    activeTab,
    onChange,
    ariaLabel,
    idPrefix,
    withHomeEnd = false,
    panelMounting,
    className,
}: TabsPillProps<T>) {
    const values = tabs.map(t => t.value);
    const { getTabProps } = useTabs({
        tabs: values,
        activeTab,
        onChange,
        idPrefix,
        withHomeEnd,
        panelMounting,
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
                                : 'border-border-control text-secondary-400 hover:text-secondary-200 border'
                        )}
                    >
                        {tab.label}
                    </button>
                );
            })}
        </div>
    );
}
