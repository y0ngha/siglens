'use client';

import {
    type ChangeEvent,
    type FocusEvent,
    type KeyboardEvent,
    type RefObject,
    useCallback,
    useEffect,
    useEffectEvent,
    useRef,
    useState,
} from 'react';
import { useOnClickOutside } from '@/shared/hooks/useOnClickOutside';
import type { TickerSearchResult } from '@/shared/lib/types';
import {
    isCaretKey,
    isOptionStepKey,
    stepOptionIndex,
} from '../lib/comboboxKeys';
import { isImeComposing } from '../lib/isImeComposing';
import { normalizeLabel } from '../lib/normalizeLabel';
import {
    resolvePendingSubmit,
    type SubmitTarget,
} from '../lib/resolveSubmitTarget';
import { resultDisplayNames } from '../lib/resultDisplay';
import { deriveSearchState, type SearchStatus } from '../lib/searchStatus';
import { useSymbolNavigation } from './useSymbolNavigation';
import { useTickerSearch } from './useTickerSearch';

/** 선택된 종목. 최근 검색이 티커가 아니라 회사명으로 남도록 표시 이름을 함께 싣는다. */
export interface AutocompleteSelection {
    symbol: string;
    /** 표시 이름. 직접 친 문자열이면 그 문자열(대문자) 자체다. */
    label: string;
}

/** `useAutocomplete`의 옵션. */
export interface UseAutocompleteOptions {
    /** 항목을 고르거나 검색 키로 목적지가 정해졌을 때 부른다. */
    onSelect?: (entry: AutocompleteSelection) => void;
    /**
     * 고르면 `/{symbol}`로도 이동할지. 기본값 true(헤더·홈 히어로의 검색창).
     * 폼 안의 값 선택기로 쓰는 호출부(`portfolio-management`의 `HoldingForm`)는 false를
     * 넘겨야 한다 — 거기서 종목을 고르는 것은 칸을 채우는 일이지 페이지를 떠나는 일이 아니다.
     */
    navigateOnSelect?: boolean;
}

/** `useAutocomplete`의 반환값. 함수는 모두 참조가 안정적이다(deps가 바뀔 때만 새로 만든다). */
export interface UseAutocompleteReturn {
    query: string;
    results: readonly TickerSearchResult[];
    /** 드롭다운이 보여 줄 상태(조회 중·실패·결과·결과 없음). 실패는 "결과 없음"과 구분된다. */
    status: SearchStatus;
    /** 활성 옵션 인덱스. -1이면 활성 옵션이 없다(포커스는 늘 입력에 있다). */
    selectedIndex: number;
    isOpen: boolean;
    inputRef: RefObject<HTMLInputElement | null>;
    dropdownRef: RefObject<HTMLDivElement | null>;
    handleChange: (e: ChangeEvent<HTMLInputElement>) => void;
    handleKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
    handleFocus: () => void;
    /** 포커스가 입력과 드롭다운 밖으로 나가면(Tab) 드롭다운을 닫는다. */
    handleBlur: (e: FocusEvent<HTMLInputElement>) => void;
    handleSearchClick: () => void;
    navigate: (symbol: string, label?: string) => void;
    prefetch: (symbol: string) => void;
}

/**
 * 데스크톱 인라인 자동완성(`TickerAutocomplete`)의 상태와 키보드 모델.
 *
 * WAI-ARIA APG의 편집 가능한 combobox를 따른다 — 포커스는 입력에 머물고 활성 옵션은
 * `selectedIndex`로만 가리킨다. 방향키는 옵션을 옮기고(닫혀 있으면 다시 연다), Enter는
 * 활성 옵션 또는 검색 키, Escape·Tab·바깥 클릭은 닫기, Home/End는 활성 옵션을 해제하고
 * 캐럿을 옮긴다.
 */
export function useAutocomplete({
    onSelect,
    navigateOnSelect = true,
}: UseAutocompleteOptions = {}): UseAutocompleteReturn {
    const [query, setQuery] = useState('');
    const [isClosed, setIsClosed] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    /**
     * 고른 항목 없이 검색 키를 눌렀다는 사실. 즉시 결정하지 않고 남겨 둔다.
     *
     * 디바운스가 300ms라 마지막 글자를 치고 바로 Enter를 누르면 결과가 아직 이전
     * 질의의 것이다. 그때 결정하면 엉뚱한 종목으로 가거나(`apple` → `/APPLE` 404)
     * 아무 일도 안 일어나 **검색 키가 먹통으로** 보인다. 결착된 뒤 처리하면 둘 다
     * 피한다. 오버레이(`useOverlaySearch`)가 같은 규칙을 쓴다.
     */
    const [isSubmitArmed, setIsSubmitArmed] = useState(false);
    /**
     * 결착된 뒤 실제로 고른 목적지. 계산(`resolvePendingSubmit`)과 로컬 입력 리셋은
     * 아래에서 **렌더 중** 끝낸다 — `query`/`results`가 바로 이 렌더의 최신값이다.
     * 실제 이동(`onSelect`·라우팅)만 아래 effect가 맡는다 — 부수효과라 렌더 중에 할 수 없다.
     */
    const [pendingNav, setPendingNav] = useState<SubmitTarget | null>(null);
    /**
     * 이미 쏜 목적지. effect는 같은 `pendingNav`로 다시 돌 수 있으므로(숨겨졌다 다시
     * 보이는 트리의 effect 재연결) 한 목적지를 두 번 쏘지 않게 막는다.
     */
    const firedNavRef = useRef<SubmitTarget | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const { goToSymbol, prefetchSymbol } = useSymbolNavigation();
    const search = useTickerSearch(query);
    const { results, isSearching, hasQuery, isError } = search;

    const close = useCallback(() => {
        setIsClosed(true);
        // 닫힌 목록의 옵션을 활성으로 남기면 `aria-activedescendant`가 사라진 요소를
        // 가리키고, 다시 열었을 때 손대지 않은 옵션이 Enter의 대상이 된다.
        setSelectedIndex(-1);
    }, []);

    const requestSubmit = useCallback(() => setIsSubmitArmed(true), []);

    /**
     * 고른 종목을 알리고(`onSelect`) 이동한다. 지역 상태를 건드리지 않으므로 아래 effect가
     * 그대로 부를 수 있다 — 지역 상태 리셋은 호출부(이벤트 핸들러·렌더 중 조정)가 맡는다.
     */
    const commitSelection = useCallback(
        (symbol: string, label: string | undefined) => {
            onSelect?.({ symbol, label: normalizeLabel(label, symbol) });
            if (navigateOnSelect) goToSymbol(symbol);
        },
        [goToSymbol, navigateOnSelect, onSelect]
    );

    const fireResolvedNav = useEffectEvent((target: SubmitTarget) => {
        commitSelection(target.symbol, target.label);
    });

    const navigate = useCallback(
        (symbol: string, label?: string) => {
            setQuery('');
            setIsClosed(true);
            setSelectedIndex(-1);
            commitSelection(symbol, label);
        },
        [commitSelection]
    );

    const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
        // 계속 타이핑하면 앞서 남긴 검색 의도는 무효다 — 그대로 두면 새 질의가
        // 결착되는 순간 사용자가 요청하지 않은 이동이 일어난다.
        setIsSubmitArmed(false);
        setQuery(e.target.value);
        setIsClosed(false);
        setSelectedIndex(-1);
    }, []);

    const handleKeyDown = useCallback(
        (e: KeyboardEvent<HTMLInputElement>) => {
            if (isOptionStepKey(e.key)) {
                e.preventDefault();
                // 닫혀 있으면(Escape 뒤) 다시 연다 — 보이지 않는 옵션을 활성으로 만들면
                // 다음 Enter가 화면에 없는 종목으로 이동한다.
                setIsClosed(false);
                const nextIndex = stepOptionIndex(
                    e.key,
                    selectedIndex,
                    results.length
                );
                setSelectedIndex(nextIndex);
                const next = results[nextIndex];
                if (next) prefetchSymbol(next.symbol);
                return;
            }
            if (isCaretKey(e.key)) {
                // 기본 동작(캐럿 이동)은 그대로 둔다.
                setSelectedIndex(-1);
                return;
            }
            if (e.key === 'Escape') {
                close();
                return;
            }
            if (e.key !== 'Enter') return;
            // 한글 IME의 음절 확정 Enter는 선택/이동이 아니다 — 오버레이와 같은 가드.
            if (isImeComposing(e)) return;
            e.preventDefault();
            const selected = results[selectedIndex];
            if (!selected) {
                requestSubmit();
                return;
            }
            // 최근 검색 라벨 계산은 `resultDisplayNames`가 단일 소스다 —
            // 같은 식을 손으로 다시 적으면 표면마다 이름이 어긋난다.
            navigate(selected.symbol, resultDisplayNames(selected).primaryName);
        },
        [close, navigate, prefetchSymbol, requestSubmit, results, selectedIndex]
    );

    const handleFocus = useCallback(() => setIsClosed(false), []);

    const handleBlur = useCallback(
        (e: FocusEvent<HTMLInputElement>) => {
            const next = e.relatedTarget;
            if (next instanceof Node && dropdownRef.current?.contains(next)) {
                return;
            }
            close();
        },
        [close]
    );

    // 바깥 클릭 훅은 자기가 부를 `close`가 선언된 뒤에 둔다(콜백을 입력으로 받는다).
    useOnClickOutside([inputRef, dropdownRef], close);

    const isOpen = !isClosed && hasQuery;
    const { isSettled, status } = deriveSearchState(query, search);

    /**
     * 보류해 둔 검색 의도를 결착된 뒤에 처리한다 — 렌더 중 상태 조정(REACT.md#EF-1)이다.
     *
     * 폼 모드는 기다릴 이유가 없다 — 확정 대상이 친 문자열 자체다. 실패
     * (`isError`)면 아무 데도 가지 않는다 — 실패한 조회의 빈 결과는 "없다"가 아니다.
     */
    const canResolveSubmit = !navigateOnSelect || (isSettled && !isSearching);
    if (isSubmitArmed && canResolveSubmit) {
        setIsSubmitArmed(false);
        const target = resolvePendingSubmit(query, results, {
            navigateOnSelect,
            isError,
        });
        if (target) {
            setQuery('');
            setIsClosed(true);
            setSelectedIndex(-1);
            setPendingNav(target);
        }
    }

    /**
     * 결착된 목적지로 실제 이동한다. 로컬 리셋은 렌더 중 조정이 이미 끝냈으므로 여기서는
     * `onSelect`/라우팅만 한다. `onSelect`는 콜백 prop이라 deps에 두지 않고
     * effect event로 최신 값을 읽는다(REACT.md#EF-2).
     */
    useEffect(() => {
        if (!pendingNav || firedNavRef.current === pendingNav) return;
        firedNavRef.current = pendingNav;
        // 선택 확정(pendingNav) 이후 한 번만 onSelect를 쏘는 의도된 구조다. 렌더 중 호출/로컬 setState 연쇄를 피하려고 effect에 둔다.
        // react-doctor-disable-next-line react-doctor/no-pass-data-to-parent, react-doctor/no-pass-live-state-to-parent
        fireResolvedNav(pendingNav);
    }, [pendingNav]);

    return {
        query,
        results,
        status,
        selectedIndex,
        isOpen,
        inputRef,
        dropdownRef,
        handleChange,
        handleKeyDown,
        handleFocus,
        handleBlur,
        handleSearchClick: requestSubmit,
        navigate,
        prefetch: prefetchSymbol,
    };
}
