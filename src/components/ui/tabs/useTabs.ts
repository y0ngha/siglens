'use client';

import {
    type KeyboardEvent,
    type RefCallback,
    useCallback,
    useId,
    useRef,
} from 'react';
import { useRovingKeyboardNav } from '@/components/hooks/useRovingKeyboardNav';
import { buildPanelId, buildTabId } from './utils/tabIds';

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
