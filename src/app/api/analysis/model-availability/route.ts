import { NextResponse } from 'next/server';
import { listDisabledServerKeyModels } from '@/entities/llm-provider/lib/serverKeyKillSwitch';
import type { ModelAvailabilityResponse } from '@/shared/lib/modelAvailability';

// 런타임 env를 읽으므로 빌드 시점에 굳으면 안 된다. 캐시는 아래 `Cache-Control`로 CDN이 맡는다.
export const dynamic = 'force-dynamic';

/**
 * 값은 서버 재시작 전까지 바뀌지 않고 사용자와도 무관하다 — 모든 방문자가 같은 응답을
 * 받으므로 CDN에 1분 맡긴다. Server Action으로 두면 방문마다 POST가 나가고, 클라이언트의
 * 다른 액션(등급 조회 `currentUserAction`)과 한 줄로 직렬 처리돼 첫 분석이 늦어진다.
 */
const CACHE_CONTROL = 'public, s-maxage=60, stale-while-revalidate=300';

export function GET(): Response {
    const body: ModelAvailabilityResponse = {
        disabledModels: listDisabledServerKeyModels(),
    };
    return NextResponse.json(body, {
        headers: { 'Cache-Control': CACHE_CONTROL },
    });
}
