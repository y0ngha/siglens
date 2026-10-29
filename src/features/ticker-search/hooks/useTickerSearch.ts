'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchTickerSearch } from '@/entities/ticker/lib/fetchTickerSearch';
import {
    QUERY_KEYS,
    TICKER_SEARCH_STALE_TIME_MS,
} from '@/shared/config/queryConfig';
import { useHydrated } from '@/shared/hooks/useHydrated';
import { reportClientError } from '@/shared/lib/reportClientError';
import type { TickerSearchResult } from '@/shared/lib/types';
import type { SearchSnapshot } from '../lib/searchStatus';

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 1;
/** 결과가 아직 없을 때의 값. 렌더마다 새 배열을 주면 이를 deps로 쓰는 콜백이 매번 바뀐다. */
const NO_RESULTS: TickerSearchResult[] = [];

/** `useTickerSearch`의 반환값. 조회 상태 필드는 `SearchSnapshot`에서 정의한다. */
export interface UseTickerSearchResult extends SearchSnapshot {
    results: TickerSearchResult[];
}

/**
 * 입력 중인 질의로 티커를 검색한다(300ms 디바운스). 데스크톱 자동완성과 모바일 오버레이가
 * 함께 쓴다.
 *
 * 질의는 앞뒤 공백을 떼고 조회한다. 서버도 공백을 떼므로 `aapl `과 `aapl`은 같은 결과다 —
 * 그대로 키로 쓰면 같은 응답을 두 번 받고, 공백만 친 입력은 빈 질의로 요청을 보내
 * "결과 없음"을 띄운다(최근·인기 종목 대신).
 */
export function useTickerSearch(query: string): UseTickerSearchResult {
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const reportedErrorRef = useRef<unknown>(null);
    const isHydrated = useHydrated();

    const isDebouncedQueryReady = debouncedQuery.length >= MIN_QUERY_LENGTH;

    const isEnabled = isHydrated && isDebouncedQueryReady;

    const { data, isError, error, status, isFetching } = useQuery({
        queryKey: QUERY_KEYS.tickerSearch(debouncedQuery),
        // 캐시 가능한 GET이다(`fetchTickerSearch` JSDoc). `signal`로 지난 키 입력의 요청을 끊는다.
        queryFn: ({ queryKey: [, qQuery], signal }) =>
            fetchTickerSearch(qQuery, signal),
        enabled: isEnabled,
        /**
         * 오프라인에서도 **시도하고 실패로 끝맺는다**.
         *
         * 기본값 `'online'`은 브라우저가 오프라인이라고 판단하면 조회를 시작조차
         * 하지 않고 `fetchStatus: 'paused'`에 세워 둔다. 그러면 `isError`가 끝내
         * false라 아래 실패 UI도 `reportClientError`도 실행되지 않고, 사용자는
         * 끝나지 않는 "검색 중…"만 본다. 이 쿼리는 서드파티가 아니라 우리 오리진의
         * 라우트(`GET /api/search`)를 부르므로, 시도해 보고 "불러오지 못했어요"를 보여주는 편이 정직하다.
         *
         * 재시도가 **탭이 숨겨져 있을 때** 멈추는 것은 이 옵션과 무관한 별개 장치다
         * (`focusManager`). 보고 있지 않은 탭에서 재시도를 태우지 않는 건 의도된 동작이라
         * 그대로 둔다 — 실증 중 이 pause를 장애로 착각했다가 탭을 실사용 조건(visible)으로
         * 맞추고서야 500 주입이 `status: 'error'`로 끝나는 것을 확인했다.
         */
        networkMode: 'always',
        // FMP catalogue updates daily — long staleTime is safe and protects
        // the FMP free-tier rate limit during typing sessions.
        staleTime: TICKER_SEARCH_STALE_TIME_MS,
    });

    /**
     * 두 조건을 OR로 묶는다.
     *
     * - `status === 'pending'`: 재시도 사이의 대기 구간(`retry: 1`, 백오프 약 1초)에서는
     *   `isFetching`이 false다. 그 구간을 "검색 중"으로 치지 않으면 **"검색 결과가
     *   없습니다"가 한 번 번쩍인 뒤** 실패 화면으로 넘어간다(500 주입 실증에서 확인).
     * - `isFetching`: 한 번 실패한 키는 `status`가 `'error'`로 굳는다. 그 키를 다시
     *   조회할 때(재입력·`retryOnMount`) `pending`으로 돌아오지 않으므로, 이것만 빼면
     *   **요청이 도는 내내 실패 화면**이 떠 있고 라이브 리전도 실패를 고지한다.
     */
    const isSearching = isEnabled && (status === 'pending' || isFetching);

    /**
     * 조회 실패를 **밖으로 드러낸다**. 예전에는 `isError`를 버리고 `data ?? []`만
     * 돌려줬는데, 그러면 검색 서버가 통째로 죽어도 화면에는 "검색 결과가 없습니다"가
     * 뜬다 — 한글 질의에는 "티커로 검색해 보세요"라는 **틀린 안내**까지 나간다.
     * 게다가 클라이언트·서버 어느 쪽에도 신호가 남지 않아 사용자가 제보하기 전까지
     * 아무도 모른다(라우트의 `console.error`만으로는 사용자 쪽 실패가 집계되지 않는다).
     */
    useEffect(() => {
        if (!isError || !error) return;
        // 같은 실패를 두 번 세지 않는다. 키 A(실패) → 키 B → 키 A로 돌아오면
        // `error`가 `있음 → undefined → 있음`으로 바뀌어 effect가 다시 돈다.
        // 보고는 로드당 5건이 상한이고 그 수를 CloudWatch 알람이 집계하므로,
        // 중복이 예산을 태우고 장애 규모를 부풀린다.
        if (reportedErrorRef.current === error) return;
        reportedErrorRef.current = error;
        reportClientError(error, 'useTickerSearch');
    }, [isError, error]);

    useEffect(() => {
        const trimmed = query.trim();
        const isLongEnough = trimmed.length >= MIN_QUERY_LENGTH;
        const timer = setTimeout(
            () => setDebouncedQuery(isLongEnough ? trimmed : ''),
            isLongEnough ? DEBOUNCE_MS : 0
        );
        return () => clearTimeout(timer);
    }, [query]);

    return {
        results: data ?? NO_RESULTS,
        isSearching,
        hasQuery: isDebouncedQueryReady,
        debouncedQuery,
        isError,
    };
}
