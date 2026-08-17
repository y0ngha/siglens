'use client';

import { useQuery } from '@tanstack/react-query';
import type {
    MarketBriefingResponse,
    RunBriefingResult,
} from '@y0ngha/siglens-core';
import { runAnalysisStream } from '@/shared/hooks/useAnalysisStream';
import type { MarketBriefingActionResult } from '@/shared/lib/types';
import { useHydrated } from '@/shared/hooks/useHydrated';
import { QUERY_KEYS } from '@/shared/config/queryConfig';

export interface UseMarketBriefingReturn {
    /**
     * BriefingRegion input — undefined=미정, null=봇, 'error'=실패,
     * cached/done=정상.
     */
    input: RunBriefingResult | null | 'error' | undefined;
}

/**
 * 마운트 후 briefing을 트리거한다. peekSeed가 있으면 초기 표시에 쓰고, 결과로 교체한다.
 * 봇이면 null(BotBlockedNotice).
 *
 * 서버 액션이 아니라 SSE를 거치는 이유 — 액션도 결국 단일 POST이고, LLM을 기다리는
 * 동안 바이트가 흐르지 않아 ALB `idle_timeout` 60초에 잘린다(실측: 침묵 61.1초 절단).
 * `runAnalysisStream`은 25초 heartbeat로 그 벽을 넘긴다.
 */
export function useMarketBriefing(
    peekSeed?: MarketBriefingResponse | null
): UseMarketBriefingReturn {
    const isHydrated = useHydrated();
    const { data, isError } = useQuery({
        queryKey: QUERY_KEYS.marketBriefing(),
        queryFn: ({ signal }) =>
            runAnalysisStream<MarketBriefingActionResult>({
                type: 'briefing',
                params: {},
                signal,
            }),
        enabled: isHydrated,
        // 전역 기본값 retry:1을 끈다 — 실패한 분석을 자동 재시도하면 방문자마다
        // LLM 왕복이 두 번 돈다. 재시도는 사용자가 명시적으로 요청할 때만.
        retry: false,
        staleTime: Infinity,
    });

    /**
     * Pre-hydration seed: peek seed가 있으면 cached처럼 노출, 없으면 undefined(렌더 안 함).
     * peek seed는 briefing 본문만 보유하므로 generatedAt이 빈 문자열이다.
     * BriefingCard가 빈 generatedAt을 조건부 렌더로 가드한다.
     * 객체 재생성은 React Compiler가 peekSeed 참조 기준으로 캐시한다(수동 useMemo 불필요).
     */
    const seedInput: RunBriefingResult | undefined = peekSeed
        ? { status: 'cached', briefing: peekSeed, generatedAt: '' }
        : undefined;

    // 스트림이 error 이벤트로 끝나면 `runAnalysisStream`이 throw하므로 data가 없다 —
    // 이때 그냥 seedInput으로 떨어지면 실패가 조용히 사라져 스켈레톤만 남는다.
    //
    // 다만 **seed가 있으면 seed가 이긴다.** seed는 서버가 peek로 읽어 온 실제 캐시
    // 본문이라, 에러 카드보다 사용자에게도 크롤러에게도 낫다(크롤러는 이 fetch가
    // 실패하는 게 기본값에 가깝다 — robots.txt가 /api/를 막고 있었다). seed가
    // 없을 때만 명시적 error를 노출한다.
    //
    // ⚠️ seed 우선은 **실패 분기 전부**에 적용해야 한다. 특히 `botBlocked`가 중요하다:
    // Googlebot의 WRS가 페이지를 렌더하면 이 fetch가 봇으로 판정돼 botBlocked로 돌아오는데,
    // 여기서 seed를 버리면 SSR HTML에 있던 브리핑 본문이 **렌더된 DOM에서 안내문으로
    // 교체된다**. 색인되는 건 렌더된 DOM이므로 그 페이지의 유일한 AI 서술이 사라진다
    // (종목 차트 페이지가 같은 이유로 이미 "교체가 아니라 추가"로 고쳐져 있다 —
    // `ChartContent`의 봇 안내 처리 참고).
    if (isError) return { input: seedInput ?? 'error' };
    if (!data) {
        return { input: seedInput };
    }
    if ('ok' in data) return { input: seedInput ?? 'error' };
    if (data.botBlocked) return { input: seedInput ?? null };
    return { input: data.briefing };
}
