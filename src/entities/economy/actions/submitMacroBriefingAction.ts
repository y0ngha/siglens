'use server';

import { headers } from 'next/headers';
import { submitMacroBriefing } from '@y0ngha/siglens-core';

import { isBot } from '@/shared/api/isBot';
import type { MacroBriefingActionResult } from '@/shared/lib/types';

import { getEconomySnapshot } from '../api/economySnapshotCache';

/**
 * /economy 거시 브리핑 클라 트리거 — `submitMarketBriefingAction` 미러.
 *
 * 봇이면 즉시 차단(잡 미제출, 비용 0). 아니면 캐시된 EconomySnapshot을 입력으로
 * core `submitMacroBriefing`에 위임(redis HIT 시 cached, miss 시 jobId).
 *
 * ## 서버사이드 rate-limit 없음 (known risk, documented)
 *
 * 현재 이 action에는 IP 기반 서버사이드 rate-limit이 없다. 기본 dedup은 두 계층으로
 * 제공된다:
 * 1. **봇 UA 차단**: `isBot(requestHeaders)`로 크롤러/스캐너를 초기 차단한다.
 * 2. **클라 mount-only 호출**: `useMacroBriefing` hook이 `useQuery` + `staleTime: Infinity`로
 *    마운트 1회만 호출한다(QueryClient 캐시가 살아있는 한 재호출 없음).
 *
 * 남은 위험: 동일 1h-버킷 내 N명의 첫 방문자가 동시에 도착하면 N개의 worker job이
 * 제출될 수 있다. worker 비용·queue 압박이 문제가 되면 `@upstash/ratelimit`을 IP 키로
 * 도입해 이 action에 gate를 추가하면 된다(rate-limit 초과 시 `{ ok: false, error:
 * 'rate_limited' }` 반환으로 클라가 graceful 처리 가능).
 */
export async function submitMacroBriefingAction(): Promise<MacroBriefingActionResult> {
    try {
        const requestHeaders = await headers();
        if (isBot(requestHeaders)) {
            return { briefing: null, botBlocked: true };
        }
        const snapshot = await getEconomySnapshot();
        const briefing = await submitMacroBriefing(snapshot);
        return { briefing, botBlocked: false };
    } catch (e) {
        console.error('[submitMacroBriefingAction] failed:', e);
        return { ok: false, error: 'server_error' };
    }
}
