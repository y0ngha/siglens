'use client';

import {
    type ChangeEvent,
    type KeyboardEvent,
    type RefObject,
    useCallback,
    useEffect,
    useRef,
    useState,
} from 'react';
import { useRouter } from 'next/navigation';
import { useHrefBase } from '@/shared/i18n/LocaleContext';
import { useLocalePath } from '@/shared/i18n/useLocalePath';
import type { TickerSearchResult } from '@/shared/lib/types';
import { assignLocation } from '@/shared/lib/crossHostNavigate';
import { useOnClickOutside } from '@/shared/hooks/useOnClickOutside';
import { useTickerSearch } from './useTickerSearch';
import { resultDisplayNames } from '../lib/resultDisplay';
import {
    resolveSubmitTarget,
    resolveTypedTarget,
    type SubmitTarget,
} from '../lib/resolveSubmitTarget';
import { normalizeLabel } from '../lib/normalizeLabel';

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
    const [isSubmitArmed, setIsSubmitArmed] = useState(false);
    /**
     * 결착된 뒤 실제로 고른 목적지. 계산(`resolveSubmitTarget`)과 로컬 입력
     * 리셋은 아래에서 **렌더 중** 끝낸다 — `query`/`results`가 바로 이 렌더의
     * 최신값이라 effect까지 미룰 이유가 없다. 실제 이동(`router.push`/`onSelect`)만
     * 아래 별도 effect가 맡는다 — 이동은 부수효과라 렌더 중에 할 수 없다.
     *
     * 이동을 `navigate()` 재사용 대신 effect가 직접 하는 이유: `navigate`는
     * `setQuery`/`setIsClosed`/`setSelectedIndex`를 같이 부르는데, 그 호출이
     * effect 안에서 일어나면(React Compiler가) 지역 상태로 이어지는 호출로 추적해
     * `set-state-in-effect`가 다시 잡는다. `navigate`는 이벤트 핸들러(ArrowDown+Enter,
     * 외부에서 직접 호출)용으로 그대로 둔다.
     */
    const [pendingNav, setPendingNav] = useState<SubmitTarget | null>(null);
    const firedNavRef = useRef<SubmitTarget | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const prefetchedRef = useRef(new Set<string>());

    const router = useRouter();
    const toLocalePath = useLocalePath();
    const base = useHrefBase();
    const { results, isSearching, hasQuery, isError, debouncedQuery } =
        useTickerSearch(query);

    useOnClickOutside([inputRef, dropdownRef], () => setIsClosed(true));

    const requestSubmit = useCallback(() => setIsSubmitArmed(true), []);

    const isOpen = !isClosed && hasQuery;
    const isSettled = debouncedQuery.trim() === query.trim();

    /**
     * 보류해 둔 검색 의도를 결착된 뒤에 처리한다 — 렌더 중 상태 조정(공식 패턴)이다.
     *
     * 폼 모드는 기다릴 이유가 없다 — 확정 대상이 친 문자열 자체다. 실패
     * (`isError`)면 아무 데도 가지 않는다 — 실패한 조회의 빈 결과는 "없다"가 아니다.
     */
    const canResolveSubmit = !navigateOnSelect || (isSettled && !isSearching);
    if (isSubmitArmed && canResolveSubmit) {
        setIsSubmitArmed(false);
        const target = !navigateOnSelect
            ? resolveTypedTarget(query)
            : isError
              ? null
              : resolveSubmitTarget(query, results);
        if (target) {
            setQuery('');
            setIsClosed(true);
            setSelectedIndex(-1);
            setPendingNav(target);
        }
    }

    const navigate = useCallback(
        (symbol: string, label?: string) => {
            setQuery('');
            setIsClosed(true);
            setSelectedIndex(-1);
            onSelect?.({ symbol, label: normalizeLabel(label, symbol) });
            if (!navigateOnSelect) return;
            const target = toLocalePath(`/${symbol}`);
            // `hrefBase`가 있으면(ai.siglens.io) 라우터의 클라이언트 내비게이션이
            // 아니라 실제 크로스오리진 이동을 해야 한다 — `router.push`는 같은
            // 앱 안의 경로로만 갈 수 있다.
            if (base) assignLocation(`${base}${target}`);
            else router.push(target);
        },
        [base, navigateOnSelect, onSelect, router, toLocalePath]
    );

    const prefetch = useCallback(
        (symbol: string) => {
            // 크로스오리진 이동(ai.siglens.io)에는 이 앱의 라우터가 데울 경로가
            // 없다 — 같은 호스트의 존재하지 않는 `/en/AAPL`을 prefetch하게 된다.
            if (base) return;
            if (prefetchedRef.current.has(symbol)) return;
            prefetchedRef.current.add(symbol);
            // prefetch도 로케일 경로여야 한다 — 아니면 ko 페이지를 데워 두고
            // 실제 이동 대상(`/en/AAPL`)은 콜드로 남는다.
            router.prefetch(toLocalePath(`/${symbol}`));
        },
        [base, router, toLocalePath]
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
                    requestSubmit();
                }
            } else if (e.key === 'Escape') {
                setIsClosed(true);
                setSelectedIndex(-1);
            }
        },
        [navigate, prefetch, requestSubmit, results, selectedIndex]
    );

    const handleSearchClick = requestSubmit;

    const handleFocus = useCallback(() => setIsClosed(false), []);

    /**
     * 결착된 목적지로 실제 이동한다. `navigate()`를 재사용하지 않는다 — 그 함수는
     * `setQuery`/`setIsClosed`/`setSelectedIndex`도 같이 부르는데(이벤트 핸들러용),
     * 그 호출이 여기(effect)에서 일어나면 지역 상태로 이어지는 호출로 추적돼
     * `set-state-in-effect`가 다시 잡는다. 로컬 리셋은 이미 위 렌더 중 조정이
     * 끝냈으므로, 여기서는 `onSelect`/라우팅만 한다 — 전부 지역 상태가 아니다.
     *
     * `firedNavRef`로 한 번만 쏜다 — `pendingNav`를 effect 안에서 지우면(setState)
     * 그 호출 자체가 다시 걸린다. ref는 렌더 중이 아니라 effect 안에서 쓰는 한 안전하다.
     */
    useEffect(() => {
        if (!pendingNav || firedNavRef.current === pendingNav) return;
        firedNavRef.current = pendingNav;
        onSelect?.({
            symbol: pendingNav.symbol,
            label: normalizeLabel(pendingNav.label, pendingNav.symbol),
        });
        if (!navigateOnSelect) return;
        const href = toLocalePath(`/${pendingNav.symbol}`);
        if (base) assignLocation(`${base}${href}`);
        else router.push(href);
    }, [pendingNav, base, navigateOnSelect, onSelect, router, toLocalePath]);

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
