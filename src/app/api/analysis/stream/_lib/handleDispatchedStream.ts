import { getCurrentUser } from '@/entities/auth/server/getCurrentUser';
import { localeFromRequestHeader } from '@/shared/lib/localeFromRequestHeader';
import { canAcceptAnalysisStream } from '@/shared/lib/sse/activeStreams';
import {
    createPromptAssemblyTracker,
    DONE_STATUS_PROBE,
    releaseGenerationGate,
    reserveGenerationGate,
    settleGenerationGate,
    type GenerationGate,
} from '../generationQuota';
import { attachModelFallback, resolveRequestModel } from '../modelFallback';
import {
    dispatchHandlerFor,
    PROMPT_PROBED_TYPES,
    QUOTA_EXEMPT_TYPES,
} from './dispatch';
import { withReaderViews } from './readerViews';
import {
    busyResponse,
    sseResponse,
    streamMessages,
    unexpectedErrorResponse,
} from './streamResponses';
import type {
    DispatchedAnalysisType,
    DispatchParams,
    DispatchQuotaContext,
} from './types';
import { withDeadline } from './withDeadline';

/**
 * 세션 조회 실패는 비회원으로 본다 — 한도가 엄격해질 뿐 생성이 새지 않는다.
 */
async function currentUserIdOrNull(): Promise<string | null> {
    const user = await getCurrentUser().catch((error: unknown) => {
        console.error('[streamAnalysisRoute] session lookup failed:', error);
        return null;
    });
    return user?.id ?? null;
}

/**
 * `technical` 이외 종류의 SSE 응답을 만든다: 모델 대체 → 생성 한도 예약 → 동시성 상한 → 핸들러 위임.
 * 게이팅과 데이터 조회는 위임받은 entity 액션이 맡는다.
 *
 * 번역자와 한도 예약은 동시성 검사 **이전**에 끝낸다 — 검사와 스트림 생성 사이에 await가 들어가면
 * 상한이 무의미해진다(`handleTechnicalStream`의 같은 설명). 꺼진 서버 키 모델은 위임 전에 기본 모델로
 * 바꾼다 — 각 액션의 게이트는 넘겨받은 모델을 그대로 믿는다(`resolveRequestModel` JSDoc).
 */
export async function handleDispatchedStream(
    request: Request,
    type: DispatchedAnalysisType,
    rawParams: DispatchParams
): Promise<Response> {
    const locale = localeFromRequestHeader(request);
    const t = await streamMessages(locale);

    const { modelId: servedModelId, fallback: modelFallback } =
        resolveRequestModel(rawParams.modelId, {
            cacheOnly: rawParams.cacheOnly === true,
        });
    const params =
        modelFallback === null
            ? rawParams
            : { ...rawParams, modelId: servedModelId };
    const clientCacheOnly = params.cacheOnly === true;
    const quota: GenerationGate = QUOTA_EXEMPT_TYPES.has(type)
        ? { kind: 'exempt' }
        : await reserveGenerationGate(
              await currentUserIdOrNull(),
              clientCacheOnly,
              request.headers
          );
    const promptTracker = createPromptAssemblyTracker();
    const quotaContext: DispatchQuotaContext = {
        cacheOnly: clientCacheOnly || quota.kind === 'rate_limited',
        rateLimited: quota.kind === 'rate_limited',
        onPromptAssembled: promptTracker.onPromptAssembled,
    };

    // 사람/봇 구분 없이 같은 상한을 쓴다. 근거는 `canAcceptAnalysisStream` 주석.
    if (!canAcceptAnalysisStream()) {
        console.warn('[analysis-stream] rejected: concurrency cap reached');
        await releaseGenerationGate(quota);
        return busyResponse(t);
    }

    try {
        const handler = dispatchHandlerFor(type);
        const work = settleGenerationGate(
            withDeadline(
                deadlineSignal =>
                    handler(params, deadlineSignal, locale, quotaContext),
                t('timeout')
            ),
            quota,
            PROMPT_PROBED_TYPES.has(type)
                ? promptTracker.probe
                : DONE_STATUS_PROBE
        );
        return sseResponse(
            attachModelFallback(
                withReaderViews(work, locale, type, rawParams.symbol),
                modelFallback
            ),
            t('generic')
        );
    } catch (err) {
        console.error('[streamAnalysisRoute] unexpected error:', err);
        await releaseGenerationGate(quota);
        return unexpectedErrorResponse(locale);
    }
}
