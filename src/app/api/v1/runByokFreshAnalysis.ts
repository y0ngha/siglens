import 'server-only';
import { getProviderForModel, type Timeframe } from '@y0ngha/siglens-core';
import {
    DEFAULT_TIMEFRAME,
    FRESH_ANALYSIS_KINDS,
    tryAcquireFreshSlot,
} from '@/app/api/ai/chat/tools/runFreshAnalysis';
import { resolveByokOnlyKey } from '@/entities/api-key/server/resolveByokOnlyKey';
import type { ApiKeyPrincipal } from '@/entities/siglens-api-key/model';
import { isAdmissibleSymbolShape } from '@/shared/config/ticker';
import type { Locale } from '@/shared/i18n/locales';
import { API_STATUS } from './apiResponse';
import {
    type Failure,
    analysisFailed,
    byokKeyRequired,
    fail,
    isKeyRequiredOutcome,
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
 * 보낸다. 로스터의 **모든** 활성 모델(free/member/byok 등급)을 호출자 자신의 provider 키로 만들 수 있다
 * (웹 화면은 하위 모델을 서버 키로 만들지만 API는 키가 있어야 한다). 순서:
 *
 *  1. 값싼 거절: 인자 모양 → 모델 결정(`model` 인자 → `users.api_default_model`) → 400.
 *  2. 사용자 키 조회(`resolveByokOnlyKey`) — 없어도 아직 거절하지 않는다(캐시 적중은 키가 필요 없다).
 *  3. **캐시만** 확인(`cacheOnly`): core에 `keyPolicy: 'byok-only'`로 키 없이(있으면 그 키로) 보낸다.
 *     core는 적중이면 키 게이트 전에 돌려주고 미스면 `miss_no_trigger`로 끝낸다. 적중이면
 *     `source: 'cache'`, LLM 미호출, `ai` 한도 미소비.
 *  4. 미스일 때만: 키가 있는지(없으면 400 `byok_key_required`) → 분석 슬롯 → `ai` 버킷 소비(429/503) →
 *     사용자 키로 생성. 키 오류·한도는 502 `provider_error`.
 *
 * core에는 호출자의 실제 tier(타임프레임 접근·정보 깊이용)와 `keyPolicy: 'byok-only'`를 넘긴다 — 키 선택은
 * tier가 아니라 정책이 정한다. 정책은 `resolveCallerKeyOptions`가 `caller`에서 만든다.
 *
 * 이 경로는 웹의 분석 사용량 한도(`checkAnalysisLimit`)·기록(`usage`) 옵션을 core에 넘기지 않으므로
 * 웹 일일 분석 횟수에 세지도, 기록하지도 않는다. API 한도는 `ai` 버킷이 따로 맡는다.
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

    // 키 조회가 실패해도 캐시 읽기는 막지 않는다 — 적중이면 키 없이 답하고, 미스일 때만 503으로 닫는다.
    let keyResult: Awaited<ReturnType<typeof resolveByokOnlyKey>> | null = null;
    let keyLookupFailed = false;
    try {
        keyResult = await resolveByokOnlyKey(principal.userId, model);
    } catch (error) {
        console.error('[api/v1 run_fresh_analysis] key lookup failed:', error);
        keyLookupFailed = true;
    }
    const userKey = keyResult?.status === 'ok' ? keyResult.apiKey : undefined;
    const keyUnavailable = (): Failure =>
        keyLookupFailed
            ? fail(
                  API_STATUS.serviceUnavailable,
                  'service_unavailable',
                  'Your registered API keys are temporarily unavailable. Retry shortly.'
              )
            : byokKeyRequired(
                  provider,
                  keyResult?.status === 'byok_key_required' &&
                      keyResult.reason === 'unreadable'
                      ? 'unreadable'
                      : 'not_registered'
              );

    try {
        const runner = await prepareRunner({
            symbol,
            kind,
            timeframe,
            model,
            locale,
            principal,
        });

        // 3. 캐시만 확인 — 키가 없는 사용자도 공유 캐시는 읽는다. 어느 종류든 `keyPolicy: 'byok-only'` +
        //    `skipEnqueueIfMiss`에서 core는 적중이면 키 없이 돌려주고, 미스면 LLM·키 게이트 전에 `miss_no_trigger`로
        //    끝낸다(종합 분석 포함).
        const probe = await runner.run({
            cacheOnly: true,
            signal,
            caller: runner.callerFor(userKey),
        });
        if (probe.status === 'cached') {
            return success(kind, timeframe, probe, 'cache', model);
        }
        if (probe.status !== 'miss_no_trigger') {
            return analysisFailed(kind, timeframe, probe);
        }

        // 4. 미스 — 여기서부터는 사용자 키로 만든다.
        if (userKey === undefined) return keyUnavailable();

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
                    // 요청 signal을 core에 넘기지 않는다. core의 진행 중 생성 합류는 BYOK 전용에서 같은 캐시 키
                    // **그리고 같은 사용자 키**끼리만 이뤄지지만, 같은 키로 동시에 부른 다른 요청(재시도·다른
                    // API 호출)이 이 생성에 합류할 수 있어 이 요청의 끊김이 그 생성을 죽이면 남의 분석까지
                    // 실패한다(에이전트 `runFreshAnalysisTool`과 같은 결정). 클라이언트가 끊으면 스트림만
                    // 닫히고 생성은 끝까지 돌아 공유 캐시를 채운다.
                    signal: NEVER_ABORTED_SIGNAL,
                    caller: runner.callerFor(userKey),
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
                // 키를 넘겼으므로 보통은 오지 않지만, core 게이트가 키를 거절하면(`key_error`) 422가 아니라
                // 400 `byok_key_required`다.
                if (isKeyRequiredOutcome(generated))
                    return byokKeyRequired(provider);
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
