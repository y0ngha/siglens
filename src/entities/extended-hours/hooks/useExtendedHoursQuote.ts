'use client';

import { useQuery } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import { getExtendedHoursQuoteAction } from '@/entities/extended-hours/actions/getExtendedHoursQuoteAction';
import { extendedSessionAt } from '@/entities/extended-hours/lib/extendedSession';
import type {
    ExtendedHoursQuote,
    ExtendedSessionKind,
} from '@/entities/extended-hours/model';
import { useHumanInteracted } from '@/shared/hooks/useHumanInteracted';
import {
    EXTENDED_QUOTE_REFETCH_MS,
    QUERY_KEYS,
} from '@/shared/config/queryConfig';
import { MS_PER_MINUTE } from '@/shared/config/time';
import { SKIP_VERSION_SKEW_RELOAD_META } from '@/shared/lib/reloadOnVersionSkew';

/** 분 경계 판정이면 충분하다 — 세션 전환을 늦어도 1분 안에 따라간다. */
function subscribeToMinuteClock(onChange: () => void): () => void {
    const id = setInterval(onChange, MS_PER_MINUTE);
    return () => clearInterval(id);
}

const getSessionKindSnapshot = (): ExtendedSessionKind | null =>
    extendedSessionAt(new Date())?.kind ?? null;

/** 서버·하이드레이션 렌더는 늘 `null` — 마운트 뒤 실제 시각으로 바뀐다. */
const getServerSessionKindSnapshot = (): ExtendedSessionKind | null => null;

/**
 * 지금이 프리·애프터마켓이면 그 종류, 아니면 `null`. 브라우저 시계로 판정하므로 세션 밖에서는
 * Server Action을 부르지 않는다(Server Action은 한 번에 하나씩 나가 다른 요청을 줄 세운다).
 */
export function useExtendedSessionKind(): ExtendedSessionKind | null {
    return useSyncExternalStore(
        subscribeToMinuteClock,
        getSessionKindSnapshot,
        getServerSessionKindSnapshot
    );
}

/**
 * 프리·애프터마켓 한 줄 시세(표시 전용). 조회하지 않을 때·값이 없을 때는 `null`이다.
 *
 * 조회 조건(모두 만족해야 한다):
 * - `useHumanInteracted()` — 이 탭에서 신뢰 입력이 있었다. 렌더만 하고 떠나는 크롤러는
 *   액션을 부르지 않는다(봇이 하루 1~2천 종목을 훑는다 — FMP 대역폭 보호). SSR·ISR은 훅이
 *   돌지 않아 애초에 부르지 못한다.
 * - 브라우저 시계가 확장 세션 안이다.
 *
 * 간격 폴링은 `refetchIntervalInBackground: false`(기본)라 숨은 탭에서는 멈추고, 다시 보이면
 * 포커스 재조회가 stale(60초)인 값만 새로 받는다. 세션이 바뀌면 이전 세션의 캐시 값은
 * `session` 불일치로 걸러 낸다.
 */
export function useExtendedHoursQuote(
    symbol: string
): ExtendedHoursQuote | null {
    const humanInteracted = useHumanInteracted();
    const sessionKind = useExtendedSessionKind();
    const { data } = useQuery({
        queryKey: QUERY_KEYS.extendedQuote(symbol),
        queryFn: ({ queryKey: [, qSymbol] }) =>
            getExtendedHoursQuoteAction(qSymbol),
        enabled: humanInteracted && sessionKind !== null,
        staleTime: EXTENDED_QUOTE_REFETCH_MS,
        refetchInterval: EXTENDED_QUOTE_REFETCH_MS,
        refetchIntervalInBackground: false,
        // 표시 보조 값이다 — 실패를 재시도로 증폭하지 않고 다음 주기를 기다린다.
        retry: false,
        // 첫 조회는 사람 입력 직후 나가는데, 그 입력이 다른 탭으로 가는 클릭이면 조회가 다음 탭
        // URL로 POST된다. 이 액션은 차트 탭 워커에만 있어 Next가 "action not found"를 내고,
        // 전역 버전 스큐 새로고침이 사용자가 시작한 탭 이동을 취소한다. 이 값은 없어도 되는 보조
        // 표시이므로 그 새로고침에서 뺀다(진짜 스큐는 같은 페이지의 다른 액션이 잡는다).
        meta: SKIP_VERSION_SKEW_RELOAD_META,
    });
    return sessionKind !== null && data?.session === sessionKind ? data : null;
}
