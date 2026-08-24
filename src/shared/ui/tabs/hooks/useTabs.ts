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
    /* `tabs` 배열은 호출부에서 매 렌더 새로 만들어지므로 effect 의존성에 그대로
       넣으면 매 렌더 재실행된다. 첫 탭 값(문자열)만 뽑아 쓴다. */
    const firstTab = tabs[0];
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
     * **`scrollIntoView`를 쓰지 않는다.** `block: 'nearest'`는 "세로로 스크롤하지
     * 말라"가 아니라 "보이게 만드는 **최소량**만큼 스크롤하라"는 뜻이다. 탭 줄은
     * 보통 스크롤 아래에 있으므로 브라우저가 뷰포트를 세로로 끌어올린다 —
     * 실측: `/market/kr`에서 섹터 탭을 누르면 페이지가 0에서 240px로 튀었고,
     * `/market`은 진입만 해도 123px에서 시작했다.
     *
     * 대신 스크롤러의 `scrollLeft`만 직접 움직인다. 뷰포트는 건드리지 않고,
     * 탭이 이미 안에 있으면 아무 일도 하지 않는다. `getBoundingClientRect`와
     * `scrollLeft`는 jsdom에도 있어(0을 돌려줄 뿐) 옵셔널 가드가 필요 없다.
     *
     * 첫 탭만 따로 0으로 되돌린다. 델타 계산만 하면 좌측 패딩(거터)이 스크롤에
     * 먹힌 상태가 "이미 보이는" 것으로 판정돼 탭 줄이 형제 섹션과 어긋난 채
     * 남는다.
     */
    useLayoutEffect(() => {
        const el = tabRefs.current.get(activeTab);
        const scroller = el?.closest<HTMLElement>('[role="tablist"]');
        if (!el || !scroller) return;

        if (activeTab === firstTab) {
            scroller.scrollLeft = 0;
            return;
        }

        const tabRect = el.getBoundingClientRect();
        const viewRect = scroller.getBoundingClientRect();
        if (tabRect.left < viewRect.left) {
            scroller.scrollLeft -= viewRect.left - tabRect.left;
        } else if (tabRect.right > viewRect.right) {
            scroller.scrollLeft += tabRect.right - viewRect.right;
        }
    }, [activeTab, firstTab]);

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
