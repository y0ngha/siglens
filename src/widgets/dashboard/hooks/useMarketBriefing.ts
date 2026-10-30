'use client';

/**
 * 시장 브리핑을 SSE로 불러오고, 서버 seed·실패 분기를 하나의 입력 상태로 합친다.
 */
import { useQuery } from '@tanstack/react-query';
import { useCurrentLocale } from '@/shared/i18n/LocaleContext';
import { useStreamErrorMessages } from '@/shared/hooks/useStreamErrorMessages';
import type {
    MarketBriefingResponse,
    RunBriefingResult,
} from '@y0ngha/siglens-core';
import { runAnalysisStream } from '@/shared/lib/sse/runAnalysisStream';
import type { MarketBriefingActionResult } from '@/shared/lib/types';
import { useHydrated } from '@/shared/hooks/useHydrated';
import { QUERY_KEYS } from '@/shared/config/queryConfig';
import type { DashboardScopeId } from '@/shared/config/dashboardScope';

export interface UseMarketBriefingReturn {
    /**
     * BriefingRegion input — undefined=미정, 'error'=실패, cached/done=정상.
     */
    input: RunBriefingResult | 'error' | undefined;
}

/**
 * 마운트 후 briefing을 트리거한다. peekSeed가 있으면 초기 표시에 쓰고, 결과로 교체한다.
 *
 * 서버 액션이 아니라 SSE를 거치는 이유 — 액션도 결국 단일 POST이고, LLM을 기다리는
 * 동안 바이트가 흐르지 않아 ALB `idle_timeout` 60초에 잘린다(침묵 61초 만에 절단된다).
 * `runAnalysisStream`은 25초 heartbeat로 그 벽을 넘긴다.
 */
export function useMarketBriefing(
    scope: DashboardScopeId,
    peekSeed?: MarketBriefingResponse | null
): UseMarketBriefingReturn {
    const locale = useCurrentLocale();
    const streamMessages = useStreamErrorMessages();
    const isHydrated = useHydrated();
    const { data, isError } = useQuery({
        queryKey: QUERY_KEYS.marketBriefing(scope, locale),
        queryFn: ({ signal }) =>
            runAnalysisStream<MarketBriefingActionResult>({
                messages: streamMessages,
                type: 'briefing',
                params: { scope },
                signal,
            }),
        enabled: isHydrated,
        // 전역 기본값 retry:1을 끈다 — 실패한 분석을 자동 재시도하면 방문자마다
        // LLM 왕복이 두 번 돈다. 재시도는 사용자가 명시적으로 요청할 때만.
        retry: false,
        staleTime: Infinity,
    });

    /**
     * 서버가 peek로 읽어 온 캐시 본문(seed). 있으면 응답이 오기 전·실패 시에도 cached처럼
     * 보여 주고, 없으면 `undefined`라 호출부가 로딩 카드를 그린다. seed는 본문만 가지므로
     * `generatedAt`이 빈 문자열이고, 생성 시각 줄은 그 값을 보고 숨겨진다.
     * 객체 재생성은 React Compiler가 peekSeed 참조 기준으로 캐시한다(수동 useMemo 불필요).
     */
    const seedInput: RunBriefingResult | undefined = peekSeed
        ? { status: 'cached', briefing: peekSeed, generatedAt: '' }
        : undefined;

    // 스트림이 error 이벤트로 끝나면 `runAnalysisStream`이 throw하므로 data가 없다 —
    // 이때 그냥 seedInput으로 떨어지면 실패가 조용히 사라져 로딩 카드만 남는다.
    //
    // 다만 **seed가 있으면 seed가 이긴다.** seed는 서버가 읽어 온 실제 캐시 본문이라
    // 에러 카드보다 사용자에게도 크롤러에게도 낫다(크롤러는 `/api/` 호출이 막혀 이 fetch가
    // 실패하는 경우가 많다). seed가 없을 때만 명시적 error를 노출한다.
    //
    // seed 우선은 **실패 분기 전부**에 적용한다. 색인되는 건 렌더된 DOM이라, 실패로
    // seed를 버리면 SSR HTML에 있던 브리핑 본문이 렌더 뒤에 사라진다.
    if (isError) return { input: seedInput ?? 'error' };
    if (!data) {
        return { input: seedInput };
    }
    if ('ok' in data) return { input: seedInput ?? 'error' };
    /*
     * 롤링 배포 중 구 컨테이너가 답하면 `scope`가 없다 — 그 브리핑은 정의상
     * 미국 것이다(구 액션은 인자를 안 받는다). 한국 페이지에서 그대로 그리면
     * "오늘 국내 증시는…" 자리에 미국 서술이 들어앉는데, 문장이 그럴듯해서
     * 아무도 못 알아챈다. seed(서버가 읽어 온 진짜 KR 캐시)로 물러난다.
     * 미국에서는 검사하지 않는다 — `useMarketSummary.matchesScope` JSDoc 참조.
     *
     * seed도 없으면 `undefined`가 아니라 `'error'`다. 이 응답은 `staleTime: Infinity`·
     * `retry: false`라 다시 오지 않으므로, `undefined`로 두면 로딩 카드가 영영 돈다.
     */
    if (scope !== 'us' && data.scope !== scope) {
        return { input: seedInput ?? 'error' };
    }
    return { input: data.briefing };
}
