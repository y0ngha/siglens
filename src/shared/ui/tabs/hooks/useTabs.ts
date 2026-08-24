'use client';

import {
    type KeyboardEvent,
    type RefCallback,
    useCallback,
    useId,
    useLayoutEffect,
    useRef,
} from 'react';
import { useRovingKeyboardNav } from '@/shared/hooks/useRovingKeyboardNav';
import { buildPanelId, buildTabId } from '@/shared/ui/tabs/utils/tabIds';

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
    const tabRefs = useRef(new Map<T, HTMLElement | null>());
    const tabRefCallbacks = useRef(new Map<T, RefCallback<HTMLElement>>());
    // focusTabRef provides a stable focusItem for useRovingKeyboardNav;
    // synced to focusTab via useLayoutEffect after focusTab is declared
    const focusTabRef = useRef<(tab: T, e: KeyboardEvent<Element>) => void>(
        () => {}
    );
    const stableFocusTab = useCallback(
        (nextTab: T, e: KeyboardEvent<Element>) =>
            focusTabRef.current(nextTab, e),
        []
    );

    const handleKeyDown = useRovingKeyboardNav({
        items: tabs,
        activeItem: activeTab,
        onChange,
        focusItem: stableFocusTab,
        withHomeEnd,
    });

    const focusTab = useCallback((nextTab: T) => {
        tabRefs.current.get(nextTab)?.focus();
    }, []);

    const getRef = useCallback((tab: T): RefCallback<HTMLElement> => {
        if (!tabRefCallbacks.current.has(tab)) {
            tabRefCallbacks.current.set(tab, el => {
                tabRefs.current.set(tab, el);
            });
        }
        return tabRefCallbacks.current.get(tab)!;
    }, []);

    useLayoutEffect(() => {
        focusTabRef.current = focusTab;
    }, [focusTab]);

    /*
     * 활성 탭을 스크롤 뷰 안으로 끌어온다.
     *
     * 탭 줄은 `overflow-x-auto` 스크롤러다. URL로 바로 들어오면(`?sector=SPACE`)
     * 활성 탭이 목록 끝에 있어도 `scrollLeft`가 0이라 화면 밖으로 잘린 채
     * 시작한다 — 사용자는 자기가 보고 있는 섹터가 뭔지 탭에서 확인할 수 없다.
     * 키보드 탐색의 `.focus()`는 완전히 가려진 탭만 끌어오고 **부분적으로 잘린**
     * 탭은 그대로 두므로 이 경우를 덮지 못한다.
     *
     * `inline: 'nearest'`라 이미 보이는 탭은 움직이지 않는다. `block: 'nearest'`가
     * 없으면 브라우저가 세로도 함께 스크롤해 페이지가 튄다.
     *
     * 호출부를 옵셔널로 둔 것은 jsdom이 `scrollIntoView`를 구현하지 않기 때문이다
     * (없는 채로 부르면 `not a function`으로 렌더가 통째로 죽는다). 순수 뷰포트
     * API라 테스트 환경에서 건너뛰어도 검증에서 잃는 것이 없다.
     */
    useLayoutEffect(() => {
        tabRefs.current.get(activeTab)?.scrollIntoView?.({
            inline: 'nearest',
            block: 'nearest',
        });
    }, [activeTab]);

    const prefix = idPrefix ?? generatedPrefix;

    const getTabProps = useCallback(
        (tab: T): TabProps => ({
            role: 'tab',
            id: buildTabId(prefix, tab),
            'aria-selected': tab === activeTab,
            'aria-controls': buildPanelId(prefix, tab),
            tabIndex: tab === activeTab ? 0 : -1,
            onClick: () => onChange(tab),
            onKeyDown: handleKeyDown,
            ref: getRef(tab),
        }),
        [activeTab, onChange, handleKeyDown, prefix, getRef]
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
