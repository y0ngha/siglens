'use client';

import { useLocalePath } from '@/shared/i18n/useLocalePath';
import {
    useDeferredValue,
    useEffect,
    useRef,
    useState,
    useTransition,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Timeframe } from '@y0ngha/siglens-core';
import { DEFAULT_TIMEFRAME, isValidTimeframe } from '@/shared/config/market';
import { getBarsAction } from '@/entities/bars/actions/getBarsAction';
import { QUERY_KEYS } from '@/shared/config/queryConfig';
import { useAssetInfo } from '@/entities/ticker/hooks/useAssetInfo';
import {
    usePickUntilPopstate,
    useUrlSearchParam,
} from '@/shared/hooks/useUrlSearchParam';

const TIMEFRAME_QUERY_PARAM = 'tf';

interface PendingTimeframeSwitch {
    to: Timeframe;
    /** 전환을 시작한 시점의 timeframe — 여기서 벗어나면(도착이든 강제 변경이든) 끝난 것이다. */
    from: Timeframe;
}

interface UseTimeframeChangeResult {
    timeframe: Timeframe;
    /**
     * 셀렉터에 보여줄 값 — 클릭(또는 URL 변화) 즉시 새 타임프레임. `timeframe`은 새 봉
     * 데이터가 도착해 렌더가 커밋될 때까지 이전 값에 머문다.
     */
    displayTimeframe: Timeframe;
    /**
     * 새 타임프레임으로 가는 중인데 차트가 아직 이전 봉을 보여주는 동안 true — 사용자
     * 선택뿐 아니라 `?tf=` 딥링크·tier 하이드레이션·뒤로/앞으로 가기로 바뀔 때도 켜진다.
     */
    isTimeframeSwitching: boolean;
    /** 타임프레임이 변경된 누적 횟수. 0이면 초기 마운트, 1 이상이면 타임프레임 변경으로 인한 마운트다. */
    timeframeChangeCount: number;
    handleTimeframeChange: (nextTimeframe: Timeframe) => void;
}

export function useTimeframeChange(
    symbol: string,
    isFreeTier: boolean,
    isTierHydrated: boolean
): UseTimeframeChangeResult {
    const [timeframeChangeCount, setTimeframeChangeCount] = useState(0);
    const [, startTransition] = useTransition();
    const pendingNavigationRef = useRef<Timeframe | null>(null);
    const [pending, setPending] = useState<PendingTimeframeSwitch | null>(null);

    // `useSearchParams` 대신 쓴다 — 그건 이 서브트리 전체를 CSR bailout시켜 차트 탭이
    // 서버 HTML에 스켈레톤만 남겼다(`useUrlSearchParam` JSDoc). 서버·하이드레이션
    // 렌더는 `null`(= DEFAULT_TIMEFRAME)이라 SSR HTML이 모든 방문자에게 같다.
    const tf = useUrlSearchParam(TIMEFRAME_QUERY_PARAM);
    // 사용자가 고른 타임프레임. URL(`replaceState`는 구독자에게 알려지지 않는다)보다
    // 우선하고, 뒤로/앞으로 가기(popstate)가 오면 무효가 돼 URL을 다시 따른다.
    const [pickedTimeframe, pickTimeframe] = usePickUntilPopstate<Timeframe>();
    const assetInfo = useAssetInfo(symbol);
    const queryClient = useQueryClient();
    const toLocalePath = useLocalePath();

    const urlTimeframe = isValidTimeframe(tf) ? tf : DEFAULT_TIMEFRAME;
    const requestedTimeframe = pickedTimeframe ?? urlTimeframe;
    const gatedTimeframe =
        (!isTierHydrated || isFreeTier) &&
        requestedTimeframe !== DEFAULT_TIMEFRAME
            ? DEFAULT_TIMEFRAME
            : requestedTimeframe;
    // 훅 선언 순서 예외(MISTAKES.md #17): 아래 두 훅은 파생 변수 gatedTimeframe/
    // timeframe을 입력으로 받으므로 그 계산 직후에 둔다.
    //
    // URL에서 온 변화(`?tf=` 딥링크의 하이드레이션 직후 재렌더, tier 하이드레이션,
    // popstate)는 **긴급(sync) 업데이트**다 — 그대로 쓰면 ChartContent의
    // `useSuspenseQuery`가 새 봉을 기다리며 suspend하고, 긴급 렌더의 suspend는
    // Suspense fallback(ChartSkeleton)을 다시 띄운다(차트가 통째로 깜빡인다).
    // `useDeferredValue`는 그 값을 저우선순위 렌더로 넘기므로, 새 봉이 올 때까지
    // 이전 차트가 그대로 남고 `isTimeframeSwitching`으로 "바뀌는 중"만 표시된다.
    // 초기값을 DEFAULT_TIMEFRAME으로 주는 이유: 하이드레이션 렌더가 서버 HTML(기본
    // 타임프레임)과 같은 값을 쓰게 하고, URL 값은 그다음 지연 렌더에서 반영하기 위해서다.
    // 사용자 선택은 이미 `startTransition` 안에서 일어나므로 지연 없이 그 값이 쓰인다.
    const timeframe = useDeferredValue(gatedTimeframe, DEFAULT_TIMEFRAME);
    const previousTimeframeRef = useRef<Timeframe>(timeframe);

    // 전환이 끝나면(목적지 도착, 또는 tier 강등처럼 전환 도중 timeframe이 다른 값으로
    // 강제 변경되는 경우 모두) pending을 푼다 — 렌더 중 조정 패턴(SearchOverlayContext와
    // 동일). `pending.to === timeframe`만 보면 "시작 시점에서 벗어났지만 목적지도
    // 아닌" 강제 변경(로그아웃으로 free 강등 → DEFAULT_TIMEFRAME)에서 스피너가 영영
    // 안 풀린다 — 그래서 `from`과 달라졌는지로 판정한다.
    if (pending !== null && timeframe !== pending.from) {
        setPending(null);
    }

    const handleTimeframeChange = (nextTimeframe: Timeframe): void => {
        if (!isTierHydrated) return;
        if (isFreeTier && nextTimeframe !== DEFAULT_TIMEFRAME) return;
        if (nextTimeframe === timeframe) return;
        // 이전 타임프레임 쿼리 취소 — 불필요한 네트워크 요청 방지
        void queryClient.cancelQueries({
            queryKey: QUERY_KEYS.barsPrefix(symbol, timeframe),
        });
        // 새 타임프레임 데이터를 이벤트 핸들러 시점에 prefetch한다.
        // useSuspenseQuery가 렌더 도중 Server Action을 호출하면
        // Next.js 내부 Router 상태 업데이트와 충돌하므로,
        // 렌더 전에 쿼리 캐시에 데이터(또는 진행 중인 Promise)를 넣어둔다.
        void queryClient.prefetchQuery({
            queryKey: QUERY_KEYS.bars(
                symbol,
                nextTimeframe,
                assetInfo?.fmpSymbol
            ),
            queryFn: ({ queryKey: [, qSymbol, qTimeframe, qFmpSymbol] }) =>
                getBarsAction(qSymbol, qTimeframe, qFmpSymbol),
        });
        // 셀렉터·차트 dim은 transition 밖(urgent)에서 먼저 바꾼다 — 사용자는 클릭
        // 즉시 반응을 본다. 실제 timeframe 전환은 새 봉이 올 때까지 이전 차트를 유지한다.
        setPending({ to: nextTimeframe, from: timeframe });
        startTransition(() => {
            setTimeframeChangeCount(c => c + 1);
            pendingNavigationRef.current = nextTimeframe;
            pickTimeframe(nextTimeframe);
            // router.replace가 아니라 history.replaceState — 서버는 `tf`를 읽지 않으므로
            // (page.tsx) RSC 왕복(1~2MB)이 순수 낭비였고, 그 응답이 올 때까지 화면이
            // 전혀 바뀌지 않았다. 화면은 위의 로컬 선택이 바꾸고, 이 호출은 주소(공유·
            // 새로고침용)만 맞춘다. 라우터를 우회하므로 로케일 접두사는 직접 붙인다
            // (아래 free tier 캐노니컬라이즈와 같은 이유).
            window.history.replaceState(
                null,
                '',
                toLocalePath(
                    `/${symbol}?${TIMEFRAME_QUERY_PARAM}=${nextTimeframe}`
                )
            );
        });
    };

    useEffect(() => {
        if (
            !isTierHydrated ||
            !isFreeTier ||
            tf === null ||
            tf === DEFAULT_TIMEFRAME
        ) {
            return;
        }

        // free tier의 intraday 딥링크를 daily로 캐노니컬라이즈하는 순수 URL 보정이다.
        // SSR page.tsx는 ISR을 static으로 유지하려고 tf를 읽지 않고, 파생 timeframe도
        // free 호출자에게는 이미 DEFAULT_TIMEFRAME을 강제하므로
        // 서버에서 다시 가져올 데이터가 없다. router.replace()는 불필요한 RSC 왕복을
        // 유발할 뿐 아니라, 이 마운트 시점 effect에서 호출되면 초기 렌더·suspense
        // 폭풍과 겹쳐 navigation transition이 인터럽트되며 history 커밋이 조용히
        // 드롭된다(약 절반 확률). 그러면 tf가 intraday로 남지만 effect의 의존성은
        // 변하지 않아 재시도되지 않고, e2e waitForURL이 60s 타임아웃한다. 대신
        // window.history.replaceState는 URL을 동기적으로 바꾸므로 캐노니컬라이즈가
        // 결정적으로 완료된다(Next 공식 검색 파라미터 갱신 패턴). 이 훅은
        // `useUrlSearchParam`으로 읽고, 그 저장소는 popstate만 구독하므로 이 쓰기를
        // 다시 읽지 않는다 — 화면은 이미 위의 게이트가 DEFAULT로 맞춰 두었다.
        // 라우터를 우회하는 경로라 로케일 접두사를 직접 붙여야 한다 — 빼면
        // `/en/AAPL?tf=1Hour` 진입 시 URL이 조용히 `/AAPL?tf=1Day`가 되어
        // 사용자가 고른 언어가 브라우저 주소에서 사라진다(네트워크·라우터
        // 레벨 검사로는 보이지 않는다).
        window.history.replaceState(
            null,
            '',
            toLocalePath(
                `/${symbol}?${TIMEFRAME_QUERY_PARAM}=${DEFAULT_TIMEFRAME}`
            )
        );
    }, [isFreeTier, isTierHydrated, symbol, tf, toLocalePath]);

    useEffect(() => {
        if (!isTierHydrated) return;
        if (timeframe === previousTimeframeRef.current) return;

        previousTimeframeRef.current = timeframe;
        if (pendingNavigationRef.current === timeframe) {
            pendingNavigationRef.current = null;
            return;
        }
        setTimeframeChangeCount(count => count + 1);
    }, [isTierHydrated, timeframe]);

    return {
        timeframe,
        displayTimeframe: pending?.to ?? gatedTimeframe,
        isTimeframeSwitching: pending !== null || timeframe !== gatedTimeframe,
        timeframeChangeCount,
        handleTimeframeChange,
    };
}
