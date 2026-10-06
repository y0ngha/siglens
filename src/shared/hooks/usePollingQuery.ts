'use client';

import { useLayoutEffect, useRef, type RefObject } from 'react';
import { type Query, type QueryKey, useQuery } from '@tanstack/react-query';

/** 한 번의 폴링 결과. */
export type PollOutcome<T> =
    | { ok: true; data: T }
    | { ok: false; error: Error };

/** 결과를 보고 이 호출부의 폴링을 이어갈지. */
export type PollDecision = 'continue' | 'stop';

/**
 * 호출부 판정 콜백. 렌더가 아니라 쿼리 갱신 알림 안에서 불리므로 setState·콜백 호출을 해도
 * 된다. `elapsedMs`는 이 호출부가 폴링을 시작한(`enabled`가 처음 참이 된) 뒤 흐른 시간이다.
 */
export type OnPollSettled<T> = (
    outcome: PollOutcome<T>,
    elapsedMs: number
) => PollDecision;

interface UsePollingQueryOptions<T> {
    queryKey: QueryKey;
    queryFn: () => Promise<T>;
    intervalMs: number;
    /** `false`면 이 호출부는 폴링하지 않고 결과도 판정하지 않는다(캐시 값은 그대로 읽는다). */
    enabled: boolean;
    onSettled: OnPollSettled<T>;
    /**
     * 서버가 렌더에 쓴 스냅샷. 첫 응답 전까지 이 값을 보여 주고, 곧바로 낡은 것으로 취급해
     * 마운트 때 다시 조회한다(`initialDataUpdatedAt: 0`). 쿼리가 이미 있으면(같은 화면의 다른
     * 폴러가 먼저 만들었으면) 무시된다.
     */
    initialData?: T;
}

interface PollTracker {
    queryHash: string;
    startedAt: number;
    lastDataAt: number;
    lastErrorAt: number;
    stopped: boolean;
}

function startTracker<T>(query: Query<T, Error, T, QueryKey>): PollTracker {
    return {
        queryHash: query.queryHash,
        startedAt: Date.now(),
        lastDataAt: query.state.dataUpdatedAt,
        lastErrorAt: query.state.errorUpdatedAt,
        stopped: false,
    };
}

function toError(reason: unknown): Error {
    return reason instanceof Error ? reason : new Error(String(reason));
}

/**
 * 쿼리 갱신마다 TanStack이 부르는 `refetchInterval` 판정.
 *
 * 새로 도착한 결과(성공은 `dataUpdatedAt`, 실패는 `errorUpdatedAt`이 앞으로 간 것)만
 * 한 번씩 `onSettled`에 넘기고, 그 판정으로 다음 간격(또는 중단 `false`)을 돌려준다. 같은 키를
 * 다른 호출부가 폴링해 가져온 결과도 여기서 똑같이 판정된다 — 같은 화면의 두 폴러가 요청
 * 하나를 나눠 쓰는 이유다.
 */
function evaluatePoll<T>(
    query: Query<T, Error, T, QueryKey>,
    trackerRef: RefObject<PollTracker | null>,
    onSettledRef: RefObject<OnPollSettled<T>>,
    intervalMs: number,
    enabled: boolean
): number | false {
    if (!enabled) return false;
    const tracker = trackerRef.current;
    if (tracker === null || tracker.queryHash !== query.queryHash) {
        trackerRef.current = startTracker(query);
        return intervalMs;
    }
    if (tracker.stopped) return false;

    const { dataUpdatedAt, errorUpdatedAt, data, error } = query.state;
    const elapsedMs = Date.now() - tracker.startedAt;
    const outcome: PollOutcome<T> | null =
        dataUpdatedAt > tracker.lastDataAt && data !== undefined
            ? { ok: true, data }
            : errorUpdatedAt > tracker.lastErrorAt
              ? { ok: false, error: toError(error) }
              : null;
    if (outcome === null) return intervalMs;

    const stopped = onSettledRef.current(outcome, elapsedMs) === 'stop';
    trackerRef.current = {
        ...tracker,
        lastDataAt: dataUpdatedAt,
        lastErrorAt: errorUpdatedAt,
        stopped,
    };
    return stopped ? false : intervalMs;
}

/**
 * 손으로 만든 `setInterval` 대신 `useQuery`의 `refetchInterval`로 도는 폴러.
 *
 * - **중복 제거**: 같은 키를 쓰는 폴러(예: 뉴스 탭의 카드 목록과 AI 요약 대기)가 한 쿼리를
 *   공유한다. 예전에는 둘이 따로 3초마다 Server Action을 보내 같은 응답을 두 번 받았다.
 * - **숨은 탭에서 멈춤**: `refetchIntervalInBackground: false` — 보고 있지 않은 탭에서 5분
 *   상한까지 요청을 태우지 않는다. 탭이 다시 보이면 다음 틱부터 이어간다.
 * - **바뀐 게 없으면 재렌더 없음**: 구조적 공유로 응답이 이전과 같으면 `data` 참조가
 *   그대로라 호출부가 다시 그려지지 않는다. 예전 폴러는 매 틱 `setItems(fresh)`로 목록
 *   전체를 다시 그렸다.
 * - **언마운트 정리**: 옵저버가 빠지면 TanStack이 타이머를 지운다. 이미 날아간 요청의
 *   응답은 캐시에만 들어가고 언마운트된 컴포넌트의 상태를 쓰지 않는다.
 *
 * - **낡은 캐시가 스냅샷을 이기지 않음**: `gcTime: 0` + `initialData`(서버 스냅샷) — 이전
 *   방문의 캐시가 남아 이번 렌더의 스냅샷을 덮는 일이 없다.
 *
 * 종료 조건은 호출부마다 달라서 `onSettled`가 정한다(결과마다 한 번).
 */
export function usePollingQuery<T>({
    queryKey,
    queryFn,
    intervalMs,
    enabled,
    onSettled,
    initialData,
}: UsePollingQueryOptions<T>): T | undefined {
    const trackerRef = useRef<PollTracker | null>(null);
    const onSettledRef = useRef<OnPollSettled<T>>(onSettled);

    const { data } = useQuery<T, Error, T, QueryKey>({
        queryKey,
        queryFn,
        enabled,
        initialData,
        initialDataUpdatedAt: 0,
        // 폴러가 모두 빠지면 캐시도 바로 버린다. 남겨 두면 다음 방문의 첫 렌더가 이전 방문의
        // 목록(서버가 방금 그린 스냅샷보다 낡을 수 있다)으로 스냅샷을 덮는다 — 공유는 같은
        // 화면에 동시에 떠 있는 폴러끼리만 필요하다.
        gcTime: 0,
        retry: false,
        refetchOnWindowFocus: false,
        refetchIntervalInBackground: false,
        refetchInterval: query =>
            evaluatePoll<T>(
                query,
                trackerRef,
                onSettledRef,
                intervalMs,
                enabled
            ),
    });

    useLayoutEffect(() => {
        onSettledRef.current = onSettled;
    });

    return data;
}
