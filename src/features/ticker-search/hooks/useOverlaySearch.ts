'use client';

import {
    type ChangeEvent,
    type KeyboardEvent,
    useCallback,
    useEffect,
    useEffectEvent,
    useRef,
    useState,
} from 'react';
import type { TickerSearchResult } from '@/shared/lib/types';
import { isImeComposing } from '../lib/isImeComposing';
import {
    resolveSubmitTarget,
    type SubmitTarget,
} from '../lib/resolveSubmitTarget';
import { searchStatus, type SearchStatus } from '../lib/searchStatus';
import { useTickerSearch } from './useTickerSearch';

/** `useOverlaySearch`의 반환값. 핸들러는 참조가 안정적이다. */
export interface UseOverlaySearchReturn {
    query: string;
    results: TickerSearchResult[];
    /** 질의가 있는지(디바운스 반영 후). 없으면 최근·인기 종목을 보여 준다. */
    hasQuery: boolean;
    /** 결과 영역과 라이브 리전이 보여 주고 고지할 상태. */
    status: SearchStatus;
    handleChange: (e: ChangeEvent<HTMLInputElement>) => void;
    handleKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
}

/**
 * 모바일 검색 오버레이의 질의·조회·검색 키 처리. 화면(`SearchOverlay`)은 이 값만 그린다.
 *
 * ## 검색 키(Enter·`enterKeyHint="search"`)
 *
 * 티커를 아는 사용자가 디바운스 + 왕복 + 탭을 치르지 않게 하는 길이고, FMP 검색이 색인하지
 * 않는 종목에 닿는 유일한 길이다. 목적지는 `resolveSubmitTarget`이 정한다 — 한글 회사명은
 * 직행시키지 않는다(없는 종목 페이지로 보내게 된다).
 *
 * 누른 순간 결정하지 않고 의도를 남겼다가 조회가 결착된 뒤 처리한다. 디바운스(300ms) 때문에
 * `results`는 한 박자 전 질의의 것일 수 있어서다 — `TS` 입력 후 멈췄다가 `LA`를 이어 치고
 * 곧바로 검색하면 `TS`의 첫 결과로 가버린다. 실패(`isError`)면 아무 데도 가지 않는다 —
 * 실패한 조회의 빈 결과는 "없다"가 아니다.
 *
 * @param onSubmitTarget 결착된 검색 키의 목적지를 받는다. effect 안에서 부르므로 최신 값을
 *   effect event로 읽는다 — 호출부가 매 렌더 새 함수를 넘겨도 된다.
 */
export function useOverlaySearch(
    onSubmitTarget: (target: SubmitTarget) => void
): UseOverlaySearchReturn {
    const [query, setQuery] = useState('');
    /**
     * `submitTick`은 검색 의도가 **생겼다는 사실만** 렌더에 알리는 카운터다 — 이미 결착된
     * 상태에서 검색 키를 눌러도 아래 effect가 한 번은 돌아야 한다(다른 의존성이 안 바뀔 수
     * 있다). 의도 자체는 ref로 든다 — 소비는 렌더에 드러낼 값이 아니다.
     */
    const [submitTick, setSubmitTick] = useState(0);
    const pendingSubmitRef = useRef(false);

    const { results, isSearching, hasQuery, debouncedQuery, isError } =
        useTickerSearch(query);

    /**
     * 결착된 조회 결과로 목적지를 정해 넘긴다. effect event라 `query`·`results`·
     * `onSubmitTarget`을 항상 최신으로 읽으면서도 아래 effect의 의존성에는 들어가지 않는다.
     */
    const submitResolvedTarget = useEffectEvent(() => {
        const target = resolveSubmitTarget(query, results);
        if (target) onSubmitTarget(target);
    });

    const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
        // 계속 타이핑하면 앞서 남긴 검색 의도는 무효다 — 그대로 두면 새 질의가
        // 결착되는 순간 사용자가 요청하지 않은 이동이 일어난다(`useAutocomplete`도 같은 규칙).
        pendingSubmitRef.current = false;
        setQuery(e.target.value);
    }, []);

    const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key !== 'Enter') return;
        // 한글 IME는 음절을 **확정**할 때도 Enter를 쓴다. 이걸 걸러내지 않으면
        // `삼성전`까지 친 상태에서 확정 Enter가 `삼성` 결과로 이동시킨다.
        if (isImeComposing(e)) return;
        e.preventDefault();
        pendingSubmitRef.current = true;
        setSubmitTick(tick => tick + 1);
    }, []);

    // 양쪽을 trim해 비교한다 — `"apple "`을 친 채 검색하면 화면의 첫 결과를 믿어야 한다.
    const isSettled = debouncedQuery.trim() === query.trim();
    const status = searchStatus({
        query,
        hasQuery,
        isSearching,
        isError,
        resultCount: results.length,
    });

    // Enter 시점에 디바운스된 검색이 아직 안 끝났을 수 있어, 제출 의도를 ref에 두고 결과가 settle된 뒤에 이동한다(위 JSDoc). 핸들러에서 즉시 처리하면 한 박자 전 질의 결과로 이동한다.
    // react-doctor-disable-next-line react-doctor/no-event-handler
    useEffect(() => {
        if (!pendingSubmitRef.current || !isSettled || isSearching) return;
        pendingSubmitRef.current = false;
        if (isError) return;
        // 검색 settle 뒤 확정된 목적지로 이동/선택을 알리는 것이며 라이브 상태를 부모에 동기화하는 것이 아니다.
        // react-doctor-disable-next-line react-doctor/no-pass-data-to-parent, react-doctor/no-pass-live-state-to-parent
        submitResolvedTarget();
    }, [submitTick, isSettled, isSearching, isError]);

    return { query, results, hasQuery, status, handleChange, handleKeyDown };
}
