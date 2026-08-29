'use client';

import {
    type ChangeEvent,
    type KeyboardEvent,
    type RefObject,
    useCallback,
    useEffect,
    useEffectEvent,
    useRef,
    useState,
} from 'react';
import { useRouter } from 'next/navigation';
import { useLocalePath } from '@/shared/i18n/useLocalePath';
import type { TickerSearchResult } from '@/shared/lib/types';
import { useOnClickOutside } from '@/shared/hooks/useOnClickOutside';
import { useTickerSearch } from './useTickerSearch';
import { resultDisplayNames } from '../lib/resultDisplay';
import { resolveSubmitTarget } from '../lib/resolveSubmitTarget';

interface UseAutocompleteOptions {
    /**
     * 선택된 항목. 표시용 회사명을 함께 넘긴다 — 최근 검색이 티커가 아니라
     * 회사명으로 저장돼야 하기 때문이다(직접 입력한 문자열은 라벨이 곧 그 문자열).
     */
    onSelect?: (entry: { symbol: string; label: string }) => void;
    /**
     * Whether selecting a result also navigates to `/{symbol}`. Defaults to true
     * (the search-bar behavior used by SymbolSearchPanel/Header). Callers that embed
     * this as a plain value-picker inside a form (e.g. portfolio-management's
     * HoldingForm) must pass false — selecting a ticker there must fill the field,
     * not route away from the page mid-form.
     */
    navigateOnSelect?: boolean;
}

interface UseAutocompleteReturn {
    query: string;
    results: readonly TickerSearchResult[];
    isSearching: boolean;
    /** 조회 실패. 호출부는 "결과 없음"과 구분해 보여줘야 한다. */
    isError: boolean;
    selectedIndex: number;
    isOpen: boolean;
    inputRef: RefObject<HTMLInputElement | null>;
    dropdownRef: RefObject<HTMLDivElement | null>;
    handleChange: (e: ChangeEvent<HTMLInputElement>) => void;
    handleKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
    handleFocus: () => void;
    handleSearchClick: () => void;
    navigate: (symbol: string, label?: string) => void;
    prefetch: (symbol: string) => void;
}

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
     * 피한다. 오버레이(`SearchOverlay`)가 같은 규칙을 쓴다.
     */
    const [isSubmitRequested, setIsSubmitRequested] = useState(false);

    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const prefetchedRef = useRef(new Set<string>());

    const router = useRouter();
    const toLocalePath = useLocalePath();
    const { results, isSearching, hasQuery, isError, debouncedQuery } =
        useTickerSearch(query);

    useOnClickOutside([inputRef, dropdownRef], () => setIsClosed(true));

    const isOpen = !isClosed && hasQuery;
    const isSettled = debouncedQuery.trim() === query.trim();

    const navigate = useCallback(
        (symbol: string, label?: string) => {
            setQuery('');
            setIsClosed(true);
            setSelectedIndex(-1);
            onSelect?.({ symbol, label: label?.trim() || symbol });
            if (navigateOnSelect) router.push(toLocalePath(`/${symbol}`));
        },
        [navigateOnSelect, onSelect, router, toLocalePath]
    );

    const prefetch = useCallback(
        (symbol: string) => {
            if (prefetchedRef.current.has(symbol)) return;
            prefetchedRef.current.add(symbol);
            // prefetch도 로케일 경로여야 한다 — 아니면 ko 페이지를 데워 두고
            // 실제 이동 대상(`/en/AAPL`)은 콜드로 남는다.
            router.prefetch(toLocalePath(`/${symbol}`));
        },
        [router, toLocalePath]
    );

    const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
        // 계속 타이핑하면 앞서 남긴 검색 의도는 무효다 — 그대로 두면 새 질의가
        // 결착되는 순간 사용자가 요청하지 않은 이동이 일어난다.
        setIsSubmitRequested(false);
        setQuery(e.target.value);
        setIsClosed(false);
        setSelectedIndex(-1);
    }, []);

    const handleKeyDown = useCallback(
        (e: KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                const nextIndex = Math.min(
                    selectedIndex + 1,
                    results.length - 1
                );
                setSelectedIndex(nextIndex);
                const next = results[nextIndex];
                if (next) prefetch(next.symbol);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                const prevIndex = Math.max(selectedIndex - 1, -1);
                setSelectedIndex(prevIndex);
                const prev = results[prevIndex];
                if (prev) prefetch(prev.symbol);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                const selected = results[selectedIndex];
                if (selectedIndex >= 0 && selected) {
                    // 최근 검색 라벨 계산은 `resultDisplayNames`가 단일 소스다 —
                    // 같은 식을 손으로 다시 적으면 표면마다 이름이 어긋난다.
                    navigate(
                        selected.symbol,
                        resultDisplayNames(selected).primaryName
                    );
                } else {
                    setIsSubmitRequested(true);
                }
            } else if (e.key === 'Escape') {
                setIsClosed(true);
                setSelectedIndex(-1);
            }
        },
        [navigate, prefetch, results, selectedIndex]
    );

    const handleSearchClick = useCallback(() => setIsSubmitRequested(true), []);

    const handleFocus = useCallback(() => setIsClosed(false), []);

    /**
     * 보류해 둔 검색 의도를 실행한다.
     *
     * `useEffectEvent`라 `query`·`results`·`navigate`를 **항상 최신으로** 읽으면서도
     * 아래 효과의 의존성에는 들어가지 않는다. 렌더 중에 ref를 갈아 끼우던 예전 방식은
     * React Compiler가 최적화를 포기하게 만들고 동시성 렌더에서 안전하지 않다.
     *
     * **이동 표면과 폼 표면의 규칙이 다르다.** 이동 표면(헤더·히어로)은 친 문자열이
     * 그대로 URL이 되므로 결과를 우선하고 티커 형태를 검사한다. 반면 보유종목 추가
     * 폼(`navigateOnSelect: false`)은 이동이 아니라 **값 확정**이라 같은 규칙을 걸면
     * 안 된다 — FMP가 모르는 심볼을 넣는 것이 그 폼의 문서화된 degrade 경로이고,
     * 형태가 이상한 입력은 서버가 검증해 오류를 보여준다. 클라이언트에서 조용히
     * 삼키면 사용자는 "확인을 눌렀는데 아무 일도 없다"를 본다.
     */
    const runSubmit = useEffectEvent(() => {
        if (!navigateOnSelect) {
            const typed = query.trim().toUpperCase();
            if (typed) navigate(typed);
            return;
        }
        // 실패한 조회의 빈 결과는 "없다"가 아니다 — 드롭다운의 실패 문구를 남긴다.
        if (isError) return;
        const target = resolveSubmitTarget(query, results);
        if (target) navigate(target.symbol, target.label);
    });

    useEffect(() => {
        if (!isSubmitRequested) return;
        // 폼 모드는 기다릴 이유가 없다 — 확정 대상이 친 문자열 자체다.
        if (navigateOnSelect && (!isSettled || isSearching)) return;
        setIsSubmitRequested(false);
        runSubmit();
    }, [isSubmitRequested, isSettled, isSearching, navigateOnSelect]);

    return {
        query,
        results,
        isSearching,
        isError,
        selectedIndex,
        isOpen,
        inputRef,
        dropdownRef,
        handleChange,
        handleKeyDown,
        handleFocus,
        handleSearchClick,
        navigate,
        prefetch,
    };
}
