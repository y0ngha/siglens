'use client';

import { cn } from '@/shared/lib/cn';
import { useTabs } from '@/shared/ui/tabs/hooks/useTabs';
import type { TabItem } from '@/shared/ui/tabs/utils/tabIds';

// 'xs' — BacktestTabs 스타일 (10px, font-medium, active: primary text+border)
// 'sm' — SectorTabs 스타일 (14px, active: primary border only)
//        유일한 소비자가 SectorTabs이고 그 라벨은 전부 섹터 한국어명이라
//        uppercase는 효과가 없고 0.12em 자간은 한글을 흩뜨렸다. 둘을 걷어내고
//        12px는 탭 라벨로 작아 14px로 올렸다(`min-h-11`이라 높이는 그대로).
type TabsUnderlineSize = 'xs' | 'sm';

interface SizeStyles {
    container: string;
    innerWrapper?: string;
    button: string;
    active: string;
    inactive: string;
}

const SIZE_STYLES: Record<TabsUnderlineSize, SizeStyles> = {
    xs: {
        container: 'border-secondary-800 overflow-x-auto border-b',
        innerWrapper: 'flex min-w-max px-4',
        button: 'cursor-pointer [touch-action:manipulation] border-b-2 px-3.5 py-2.5 text-[10px] font-medium transition-colors focus-visible:ring-primary-500 focus-visible:ring-offset-secondary-900 focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none',
        active: 'border-primary-400 text-primary-400',
        inactive:
            'text-secondary-500 hover:text-secondary-300 border-transparent',
    },
    sm: {
        container:
            'border-secondary-700 flex touch-manipulation gap-6 overflow-x-auto overflow-y-hidden overscroll-x-contain border-b pb-0',
        button: '-mb-px min-h-11 shrink-0 border-b-2 px-2 pt-2 pb-2 text-sm font-semibold transition-colors duration-150 focus-visible:ring-primary-500 rounded-t focus-visible:ring-2 focus-visible:outline-none',
        active: 'text-secondary-50 border-primary-500',
        inactive:
            'text-secondary-400 hover:text-secondary-200 border-transparent',
    },
};

interface TabsUnderlineProps<T extends string> {
    tabs: readonly TabItem<T>[];
    activeTab: T;
    onChange: (tab: T) => void;
    ariaLabel: string;
    size: TabsUnderlineSize;
    idPrefix?: string;
    withHomeEnd?: boolean;
}

export function TabsUnderline<T extends string>({
    tabs,
    activeTab,
    onChange,
    ariaLabel,
    size,
    idPrefix,
    withHomeEnd,
}: TabsUnderlineProps<T>) {
    const values = tabs.map(t => t.value);
    const { getTabProps } = useTabs({
        tabs: values,
        activeTab,
        onChange,
        idPrefix,
        withHomeEnd,
    });
    const styles = SIZE_STYLES[size];

    const buttons = tabs.map(tab => {
        const props = getTabProps(tab.value);
        return (
            <button
                key={tab.value}
                type="button"
                {...props}
                className={cn(
                    styles.button,
                    props['aria-selected'] ? styles.active : styles.inactive
                )}
            >
                {tab.label}
            </button>
        );
    });

    return (
        <div role="tablist" aria-label={ariaLabel} className={styles.container}>
            {styles.innerWrapper ? (
                <div className={styles.innerWrapper}>{buttons}</div>
            ) : (
                buttons
            )}
        </div>
    );
}
