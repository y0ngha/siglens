import { readFmpConfig } from '@y0ngha/siglens-core';
import { withRetry } from '@/shared/lib/withRetry';
import { FmpHttpError } from '@/shared/api/fmp/FmpHttpError';
import {
    FMP_RENDER_FETCH_TIMEOUT_MS,
    FMP_RENDER_RETRY,
    FMP_TRANSIENT_RETRY,
    isFmpTransientError,
} from '@/shared/api/fmp/fmpRetry';
import { isRenderBudgetActive } from '@/shared/lib/renderBudget';
import { logFmpPaymentRequiredError } from '@/shared/api/fmp/fmpUserMessage';
import { toFmpSymbol } from '@/shared/lib/fmpSymbol';
import {
    assertFmpAvailableAtBuild,
    assertOnline,
    isBuildPhase,
    OFFLINE_BUILD_SERVICE,
    tripFmpBuildBreaker,
} from '@/shared/api/offlineBuild';

/** Base URL for all FMP `/stable/*` endpoints. */
export const FMP_STABLE_BASE = 'https://financialmodelingprep.com/stable';

/** Timeout for FMP fetch calls outside a page render (ms). Render path: `FMP_RENDER_FETCH_TIMEOUT_MS`. */
const FMP_FETCH_TIMEOUT_MS = 10_000;

/** Options for {@link fmpGet}. */
export interface FmpGetOptions {
    revalidate?: number;
}

/**
 * Parse the `Retry-After` response header value (seconds as integer).
 * Returns null if the header is absent, non-numeric, zero, or negative.
 */
function parseRetryAfterSeconds(header: string | null): number | null {
    if (header === null) return null;
    const seconds = Number(header);
    return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

/**
 * GET FMP /stable/<path>; appends apikey automatically.
 *
 * Transient errors (429, 5xx, network failures, timeouts) are retried up to 3
 * times with exponential backoff. Inside a page render (`runWithRenderBudget`,
 * entered by the render cache wrappers such as `staticSymbolCache`) the short
 * `FMP_RENDER_RETRY` budget applies instead — 1 retry, 3s per attempt — so a
 * slow FMP degrades the page instead of stalling the ISR render for up to a
 * minute. Non-transient 4xx errors are thrown
 * immediately as `FmpHttpError`. `readFmpConfig()` and `URLSearchParams` run
 * once per call — only `fetch()` is inside the retry loop so each attempt gets
 * a fresh `AbortSignal` timeout.
 *
 * During `next build` the retry loop is skipped and a build-wide breaker opens
 * on the first transient failure (`FMP_AT_BUILD` policy, see `offlineBuild.ts`)
 * — a single 429 retry chain is enough to push a page past Next's 60s
 * prerender timeout and fail the whole build.
 *
 * Pass `opts.revalidate` (seconds) to opt into Next.js Data Cache instead of
 * the default `cache: 'no-store'`. Callers that handle caching at a higher
 * level (e.g. Redis) should omit `opts` to keep the per-request bypass.
 */
export async function fmpGet<T>(
    path: string,
    query: Record<string, string> = {},
    opts: FmpGetOptions = {}
): Promise<T> {
    assertOnline(OFFLINE_BUILD_SERVICE.FMP, path);
    assertFmpAvailableAtBuild(path);
    const { apiKey } = readFmpConfig();
    // Normalize the ticker to FMP notation (e.g. BRK.B → BRK-B) so dual-class
    // shares resolve. Cache keys upstream still use the app symbol; only the
    // outbound FMP request is rewritten. Non-aliased symbols pass through.
    const normalized =
        query.symbol !== undefined
            ? { ...query, symbol: toFmpSymbol(query.symbol) }
            : query;
    const params = new URLSearchParams({ ...normalized, apikey: apiKey });
    // 호출 시점의 비동기 컨텍스트로 한 번 정한다 — 재시도도 같은 예산을 쓴다.
    const inRender = isRenderBudgetActive();
    const timeoutMs = inRender
        ? FMP_RENDER_FETCH_TIMEOUT_MS
        : FMP_FETCH_TIMEOUT_MS;

    const fetchOnce = async (): Promise<T> => {
        const res = await fetch(
            `${FMP_STABLE_BASE}/${path}?${params.toString()}`,
            {
                ...(opts.revalidate !== undefined
                    ? { next: { revalidate: opts.revalidate } }
                    : { cache: 'no-store' }),
                signal: AbortSignal.timeout(timeoutMs),
            }
        );
        if (!res.ok) {
            const retryAfter = parseRetryAfterSeconds(
                res.headers.get('Retry-After')
            );
            // 정규화 전 원본 심볼을 실어 보낸다 — 로그에서 심볼 귀속이 되어야
            // 402 같은 심볼 국소 오류를 실제로 조치할 수 있다(FmpHttpError 주석 참조).
            //
            // `symbols`(복수) 폴백이 필요한 이유: FMP 뉴스 엔드포인트(news/stock,
            // news/crypto)는 파라미터명이 `symbols`다. pre-warm이 뉴스를 적재하게
            // 되면서 이 경로가 밤마다 심볼당 1회(유니버스 295개 → ~300회) 불리는데, 폴백이 없으면 하필 그 호출만
            // 귀속이 안 돼 `FMP news/crypto 402`처럼 조치 불가능한 형태로 남는다(감사 F3).
            const error = new FmpHttpError(
                path,
                res.status,
                retryAfter,
                query.symbol ?? query.symbols
            );
            logFmpPaymentRequiredError(error);
            throw error;
        }
        // Malformation surfaces as TypeError in the adapter mapper, not silently.
        return (await res.json()) as T;
    };

    if (!isBuildPhase()) {
        return withRetry(
            fetchOnce,
            inRender ? FMP_RENDER_RETRY : FMP_TRANSIENT_RETRY
        );
    }
    try {
        return await fetchOnce();
    } catch (error) {
        if (isFmpTransientError(error)) tripFmpBuildBreaker(path, error);
        throw error;
    }
}
