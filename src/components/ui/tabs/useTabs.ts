'use client';

import {
    useCallback,
    useId,
    useRef,
    type KeyboardEvent,
    type RefCallback,
} from 'react';
import { useRovingKeyboardNav } from '@/components/hooks/useRovingKeyboardNav';

// 동일 prefix를 사용하는 외부 패널의 id/aria-labelledby를 맞추기 위한 헬퍼.
export function buildTabId(prefix: string, value: string): string {
    return `${prefix}-tab-${value}`;
}
export function buildPanelId(prefix: string, value: string): string {
    return `${prefix}-panel-${value}`;
}

interface UseTabsOptions<T extends string> {
    tabs: readonly T[];
    activeTab: T;
    onChange: (tab: T) => void;
    withHomeEnd?: boolean;
    idPrefix?: string;
}

interface TabProps {
    role: 'tab';
    id: string;
    'aria-selected': boolean;
    'aria-controls': string;
    tabIndex: 0 | -1;
    onClick: () => void;
    onKeyDown: (e: KeyboardEvent) => void;
    ref: RefCallback<HTMLElement>;
}

interface PanelProps {
    role: 'tabpanel';
    id: string;
    'aria-labelledby': string;
    hidden: boolean;
}

interface UseTabsReturn<T extends string> {
    getTabProps: (tab: T) => TabProps;
    getPanelProps: (tab: T) => PanelProps;
}

export function useTabs<T extends string>({
    tabs,
    activeTab,
    onChange,
    withHomeEnd = true,
    idPrefix,
}: UseTabsOptions<T>): UseTabsReturn<T> {
    const generatedPrefix = useId();
    const prefix = idPrefix ?? generatedPrefix;
    const tabRefs = useRef(new Map<T, HTMLElement | null>());

    const focusTab = useCallback((nextTab: T) => {
        tabRefs.current.get(nextTab)?.focus();
    }, []);

    const handleKeyDown = useRovingKeyboardNav({
        items: tabs,
        activeItem: activeTab,
        onChange,
        focusItem: focusTab,
        withHomeEnd,
    });

    const getTabProps = useCallback(
        (tab: T): TabProps => ({
            role: 'tab',
            id: buildTabId(prefix, tab),
            'aria-selected': tab === activeTab,
            'aria-controls': buildPanelId(prefix, tab),
            tabIndex: tab === activeTab ? 0 : -1,
            onClick: () => onChange(tab),
            onKeyDown: handleKeyDown,
            ref: el => {
                tabRefs.current.set(tab, el);
            },
        }),
        [activeTab, onChange, handleKeyDown, prefix]
    );

    const getPanelProps = useCallback(
        (tab: T): PanelProps => ({
            role: 'tabpanel',
            id: buildPanelId(prefix, tab),
            'aria-labelledby': buildTabId(prefix, tab),
            hidden: tab !== activeTab,
        }),
        [activeTab, prefix]
    );

    return { getTabProps, getPanelProps };
}
