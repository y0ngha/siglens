import 'server-only';
import { getProviderForModel, type Timeframe } from '@y0ngha/siglens-core';
import {
    DEFAULT_TIMEFRAME,
    FRESH_ANALYSIS_KINDS,
    tryAcquireFreshSlot,
} from '@/app/api/ai/chat/tools/runFreshAnalysis';
import { resolveByokOnlyKey } from '@/entities/api-key/server/resolveByokOnlyKey';
import { isApiGeneratableModel } from '@/entities/siglens-api-key/lib/apiModels';
import type { ApiKeyPrincipal } from '@/entities/siglens-api-key/model';
import { isAdmissibleSymbolShape } from '@/shared/config/ticker';
import type { Locale } from '@/shared/i18n/locales';
import { API_STATUS } from './apiResponse';
import {
    analysisFailed,
    fail,
    mapThrown,
    success,
} from './freshAnalysisOutcomes';
import { prepareRunner } from './freshAnalysisRunner';
import type { PublicToolOutcome, PublicToolResult } from './publicToolOutcome';
import { decideRateLimit, prefixRateLimitHeaders } from './rateLimitHeaders';
import { resolveRequestedModel } from './resolveFreshAnalysisModel';

/** 인스턴스의 분석 슬롯이 가득 찼을 때 클라이언트가 기다릴 초(에이전트의 `busy`와 같은 값). */
const BUSY_RETRY_AFTER_SECONDS = 60;

/**
 * `run_fresh_analysis`의 공개 API 구현 — **사용자 BYOK 키만** 쓴다. 서버 키로 LLM을 부르는 경로가 없다.
 *
 * 에이전트용 `runFreshAnalysisTool`은 서버 키를 쓰므로(기술 분석은 `providerFallback`으로 서버
 * DeepSeek/Gemini 키까지) 이 함수가 그것을 **대신한다** — `executePublicTool`이 이 도구는 이 함수로만
 * 보낸다. 순서:
 *
 *  1. 값싼 거절: 인자 모양 → 모델 결정(`model` 인자 → `users.api_default_model`) → 400.
 *  2. 사용자 키 조회(`resolveByokOnlyKey`) — 없어도 아직 거절하지 않는다(캐시 적중은 키가 필요 없다).
 *  3. **캐시만** 확인(`cacheOnly`): 적중이면 `source: 'cache'`로 돌려준다. LLM 미호출, `ai` 한도 미소비.
 *  4. 미스일 때만: 생성 가능한 모델(`byok` 등급)인지 → 키가 있는지(없으면 400 `byok_key_required`) →
 *     분석 슬롯 → `ai` 버킷 소비(429/503) → 사용자 키로 생성. 키 오류·한도는 502 `provider_error`.
 *
 * core에 넘기는 tier는 `tierForByokOnly`(pro → member)다: core는 `pro`이거나 `free`/`member` 등급 모델이면
 * 사용자 키를 무시하고 서버 키를 고른다. 호출 직전에 `assertCallerRouting`이 한 번 더 확인한다.
 */
export async function runByokFreshAnalysis(input: {
    args: Record<string, unknown>;
    principal: ApiKeyPrincipal;
    locale: Locale;
    /**
     * 클라이언트 끊김 + 도구 마감. **캐시 확인(`cacheOnly`) 호출과 응답 쪽에만** 쓰인다. 생성 호출에는 넘기지
     * 않는다(`NEVER_ABORTED_SIGNAL`) — core의 공유 생성을 이 요청의 끊김이 죽이면 안 된다. 끊김·마감이 오면
     * 응답은 `executePublicTool`의 경쟁이 닫고, 생성은 계속 돌다가 끝나면 슬롯을 반납한다.
     */
    signal: AbortSignal;
}): Promise<PublicToolResult> {
    const { args, principal, locale, signal } = input;
    const symbol =
        typeof args.symbol === 'string' ? args.symbol.toUpperCase() : '';
    const kind = typeof args.kind === 'string' ? args.kind : '';
    if (!isAdmissibleSymbolShape(symbol))
        return fail(
            API_STATUS.badRequest,
            'invalid_symbol',
            'A symbol argument is not a valid ticker shape.'
        );
    if (!FRESH_ANALYSIS_KINDS.has(kind))
        return fail(
            API_STATUS.badRequest,
            'invalid_args',
            'The tool arguments are not valid for this tool.'
        );
    // 안전한 캐스트: 도구 스키마(`validateArgs`)가 `timeframe`을 열거값으로 이미 거른 뒤에 온다.
    const timeframe =
        (args.timeframe as Timeframe | undefined) ?? DEFAULT_TIMEFRAME;

    const modelResult = await resolveRequestedModel(args.model, principal);
    if (!modelResult.ok) return modelResult.failure;
    const model = modelResult.model;
    const provider = getProviderForModel(model);

    // 서버 키 모델(free/member 등급)은 사용자 키를 쓸 수 없으니 키 조회 자체를 하지 않는다 — 키 저장소
    // 장애가 그 모델의 공유 캐시 읽기를 막지 않는다.
    const generatable = isApiGeneratableModel(model);
    let keyResult: Awaited<ReturnType<typeof resolveByokOnlyKey>> | null = null;
    if (generatable) {
        try {
            keyResult = await resolveByokOnlyKey(principal.userId, model);
        } catch (error) {
            console.error(
                '[api/v1 run_fresh_analysis] key lookup failed:',
                error
            );
            return fail(
                API_STATUS.serviceUnavailable,
                'service_unavailable',
                'Your registered API keys are temporarily unavailable. Retry shortly.'
            );
        }
    }
    const userKey = keyResult?.status === 'ok' ? keyResult.apiKey : undefined;

    try {
        const runner = await prepareRunner({
            symbol,
            kind,
            timeframe,
            model,
            locale,
            principal,
        });

        // 3. 캐시만 확인 — 키가 없는 사용자도 공유 캐시는 읽는다.
        const probe = await runner.run({
            cacheOnly: true,
            signal,
            caller: runner.callerFor({
                // 서버 키 모델(free/member 등급)에는 사용자 키를 넘기지 않는다 — core는 그 키를 무시하고
                // 서버 키를 고르는 모델이라, 넘기면 "사용자 키로 호출된다"는 오해만 만든다.
                userKey,
                byokOnly: generatable,
                // 자리표시 키는 `cacheOnly`에서만 허용된다(`assertByokOnlyRouting`).
                useProbePlaceholder: generatable && userKey === undefined,
            }),
        });
        if (probe.status === 'cached') {
            return success(kind, timeframe, probe, 'cache', model);
        }
        if (probe.status !== 'miss_no_trigger') {
            return analysisFailed(kind, timeframe, probe);
        }

        // 4. 미스 — 여기서부터는 사용자 키로 만든다.
        if (!generatable) {
            return fail(
                API_STATUS.badRequest,
                'byok_model_required',
                `There is no cached analysis for ${model}, and this API can only generate with a premium model that runs on your own key. Pick one of the BYOK models (see GET /api/v1/tools).`,
                { model }
            );
        }
        if (userKey === undefined) {
            return fail(
                API_STATUS.badRequest,
                'byok_key_required',
                keyResult?.status === 'byok_key_required' &&
                    keyResult.reason === 'unreadable'
                    ? `Your stored ${provider} key could not be read. Register it again at siglens.io/account.`
                    : `No cached analysis exists and generating one needs your own ${provider} API key. Register it at siglens.io/account.`,
                { provider }
            );
        }

        // 확인 호출이 끝나기 전에 끊기거나 마감이 지났다면 생성을 시작하지 않는다 — 슬롯도 `ai` 한도도
        // 쓰지 않는다. (이미 시작한 생성은 끊겨도 계속 돈다. 여기서 막는 것은 시작 전뿐이다.)
        if (signal.aborted)
            return fail(
                API_STATUS.gatewayTimeout,
                'aborted',
                'The request ended before generation started.'
            );

        const release = tryAcquireFreshSlot();
        if (release === null) {
            return {
                ...fail(
                    API_STATUS.serviceUnavailable,
                    'busy',
                    'The server is running the maximum number of analyses. Retry shortly.'
                ),
                headers: { 'Retry-After': String(BUSY_RETRY_AFTER_SECONDS) },
            };
        }
        let limit: Awaited<ReturnType<typeof decideRateLimit>>;
        try {
            limit = await decideRateLimit(principal.userId, 'ai');
        } catch (error) {
            release();
            throw error;
        }
        if (!limit.ok) {
            release();
            return {
                ok: false,
                status: limit.status,
                code: limit.code,
                message: limit.message,
                // `ai` 버킷 상태는 X-RateLimit-AI-*로, 재시도 대기만 `Retry-After`로 싣는다. 접두 없는
                // `X-RateLimit-*`는 `data` 버킷 값이라 덮어쓰지 않는다.
                headers: {
                    ...prefixRateLimitHeaders(limit.headers, 'AI'),
                    ...(limit.headers['Retry-After'] === undefined
                        ? {}
                        : { 'Retry-After': limit.headers['Retry-After'] }),
                },
            };
        }

        // 모든 사전 검사를 통과했다. 여기부터는 라우트가 200 스트림으로 응답한다(긴 침묵이 프록시에서
        // 끊기지 않게). 슬롯은 생성이 끝날 때 반납한다 — 이 함수가 반환한 뒤에도 생성은 계속된다.
        const completion = (async (): Promise<PublicToolOutcome> => {
            try {
                const generated = await runner.run({
                    cacheOnly: false,
                    // 요청 signal을 core에 넘기지 않는다. core `dedupeInFlight`는 같은 캐시 키의 생성을
                    // 모든 호출자(사이트 SSE·프리웜·에이전트·다른 API 호출)가 공유하므로, 이 요청의 끊김이
                    // 그 공유 생성을 죽이면 남들의 분석까지 실패한다(에이전트 `runFreshAnalysisTool`과 같은
                    // 결정). 클라이언트가 끊으면 스트림만 닫히고 생성은 끝까지 돌아 공유 캐시를 채운다.
                    signal: NEVER_ABORTED_SIGNAL,
                    caller: runner.callerFor({
                        userKey,
                        byokOnly: true,
                        useProbePlaceholder: false,
                    }),
                });
                if (
                    generated.status === 'done' ||
                    generated.status === 'cached'
                ) {
                    return success(
                        kind,
                        timeframe,
                        generated,
                        // 동시 호출이 먼저 채웠다면 캐시를 읽은 것이다(그래도 시도 한도는 소비됐다).
                        generated.status === 'cached' ? 'cache' : 'fresh',
                        model
                    );
                }
                return analysisFailed(kind, timeframe, generated);
            } catch (error) {
                return mapThrown(error, provider);
            } finally {
                release();
            }
        })();
        return {
            streaming: true,
            completion,
            headers: prefixRateLimitHeaders(limit.headers, 'AI'),
        };
    } catch (error) {
        return mapThrown(error, provider);
    }
}

/** core 공유 생성에 넘기는, 절대 abort되지 않는 signal. */
const NEVER_ABORTED_SIGNAL = new AbortController().signal;
