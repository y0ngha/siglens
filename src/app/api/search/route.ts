import { NextResponse } from 'next/server';
import { constants } from 'node:http2';
import { getClientIp } from '@/shared/api/getClientIp';
import { UNKNOWN_CLIENT_IP } from '@/shared/api/unknownClientIp';
import { searchLimiter } from './searchLimiter';
import {
    MAX_SEARCH_QUERY_LENGTH,
    searchTickerQuery,
} from '@/entities/ticker/lib/searchTickerQuery';
import type { TickerSearchResult } from '@/shared/lib/types';

// 요청 URL(`?q=`)을 읽으므로 빌드 시점에 굳을 수 없다. 캐시는 아래 `Cache-Control`이 맡는다.
export const dynamic = 'force-dynamic';

/**
 * 공개 캐시 헤더. 응답은 **전 방문자 공통**이다(질의 문자열만으로 정해지고 개인화 값이 없다).
 *
 * - `max-age=300`: 클라이언트 쿼리의 `TICKER_SEARCH_STALE_TIME_MS`(5분)와 같다 — 같은 탭에서는
 *   쿼리 캐시가, 새로고침·다른 탭에서는 브라우저 캐시가 같은 창을 이어 받는다.
 * - `s-maxage=300` + `stale-while-revalidate=3600`: 한국어 이름 번역은 첫 검색 뒤 백그라운드로
 *   채워진다(`searchTicker`의 `translateAndCache`). 공유 캐시를 길게 잡으면 번역 전 응답이 그만큼
 *   오래 남으므로 신선 구간은 짧게 두고, 만료 뒤에는 stale을 내주며 뒤에서 갱신한다.
 *
 * ⚠️ 현재 Cloudflare 캐시 규칙은 `/api`를 제외한다(`/api/notices` 라우트 JSDoc과 같은 사정).
 * 엣지 공유는 그 규칙이 추가될 때부터 동작하고, 브라우저 캐시(`max-age`)는 지금부터 동작한다.
 */
const SEARCH_CACHE_CONTROL =
    'public, max-age=300, s-maxage=300, stale-while-revalidate=3600';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

const { HTTP_STATUS_TOO_MANY_REQUESTS } = constants;

/**
 * 한도 키로 쓸 IP. 던지지 않는다 — IP 해석이 실패하면 공용 버킷 하나로 센다
 * (`/api/client-error`의 `reporterKey`와 같은 처리).
 */
async function clientKey(): Promise<string> {
    try {
        return await getClientIp();
    } catch {
        return UNKNOWN_CLIENT_IP;
    }
}

/**
 * 티커 검색 — `?q=`. 결과는 `TickerSearchResult[]`.
 *
 * Server Action(POST)에서 옮긴 이유는 `searchTickerQuery` JSDoc 참고: GET이면 브라우저·CDN이
 * 캐시하고, 클라이언트가 `AbortSignal`로 지난 키 입력의 요청을 끊을 수 있으며, Server Action
 * 큐에 줄을 서지 않는다.
 *
 * 실패는 빈 배열이 아니라 **500**으로 답한다 — 클라이언트(`useTickerSearch`)가 "결과 없음"과
 * "조회 실패"를 구분해 보여 주고 `reportClientError`로 신호를 남긴다. 실패 응답은 캐시하지 않는다.
 *
 * IP별 상한(`searchLimiter`)을 넘으면 검색하지 않고 **429**(no-store)로 답한다.
 */
export async function GET(request: Request): Promise<Response> {
    if (!searchLimiter.admit(await clientKey(), Date.now())) {
        return NextResponse.json(
            { error: 'rate_limited' },
            {
                status: HTTP_STATUS_TOO_MANY_REQUESTS,
                headers: { ...NO_STORE, 'Retry-After': '60' },
            }
        );
    }
    const query = (new URL(request.url).searchParams.get('q') ?? '').trim();
    if (query.length > MAX_SEARCH_QUERY_LENGTH) {
        return NextResponse.json(
            { error: 'query_too_long' },
            { status: 400, headers: NO_STORE }
        );
    }
    try {
        const body: TickerSearchResult[] = await searchTickerQuery(query);
        return NextResponse.json(body, {
            headers: { 'Cache-Control': SEARCH_CACHE_CONTROL },
        });
    } catch (err) {
        console.error('[api/search] unexpected error:', err);
        return NextResponse.json(
            { error: 'search_failed' },
            { status: 500, headers: NO_STORE }
        );
    }
}
