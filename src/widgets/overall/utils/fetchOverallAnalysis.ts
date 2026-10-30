import type {
    ModelId,
    OverallAnalysisResponse,
    Timeframe,
} from '@y0ngha/siglens-core';
import type { RunOverallAnalysisActionResult as CoreOverallResult } from '@/entities/analysis/actions/runOverallAnalysisAction';
import { isGateBlockedResult } from '@/entities/analysis/lib/gate';
import { AwaitingInteractionError } from '@/shared/lib/AwaitingInteractionError';
import { readPlain, type WithPlain } from '@/shared/lib/plainEnvelope';
import {
    runAnalysisStream,
    type StreamErrorMessages,
} from '@/shared/lib/sse/runAnalysisStream';
import { OverallAnalysisError, OverallCooldownError } from './overallErrors';

/**
 * 재분석 의도로 보낸 요청인데 서버가 쿨다운을 획득하지 못한 경우의 응답.
 * 쿨다운 획득은 서버가 단독으로 하므로 이 응답이 클라이언트가 쿨다운을 아는 유일한 경로다.
 */
type RunOverallAnalysisActionResult =
    | CoreOverallResult
    | { status: 'reanalyze_cooldown'; remainingMs: number };

/**
 * 요청이 서버에 무엇을 요구하는지.
 * - `cache`: 캐시만 읽는다. 미스여도 생성하지 않는다.
 * - `generate`: 캐시를 읽고 미스면 생성한다(첫 분석·오류 뒤 재시도).
 * - `reanalyze`: 사용자가 누른 재분석. 캐시 우회 여부는 서버가 쿨다운 획득으로 정한다.
 */
export type OverallRequestIntent = 'cache' | 'generate' | 'reanalyze';

/**
 * 의도를 요청 파라미터로 옮긴다. `force`(캐시 우회) 자체는 보내지 않는다 — 인증 없는
 * 공개 라우트라 클라이언트가 우회를 지시할 수 있으면 안 된다.
 */
const INTENT_PARAMS: Record<OverallRequestIntent, Record<string, true>> = {
    cache: { cacheOnly: true },
    generate: {},
    reanalyze: { reanalyze: true },
};

export interface FetchOverallAnalysisRequest {
    symbol: string;
    companyName: string;
    timeframe: Timeframe;
    modelId: ModelId;
    reasoning: boolean;
    intent: OverallRequestIntent;
}

/**
 * 종합 분석 SSE 요청을 보내고 결과 봉투를 화면용 값 또는 분류된 오류로 바꾼다.
 *
 * `done`은 `cached`와 같이 `result`를 돌려준다. 캐시 전용 요청(`cache`)이 미스면
 * `AwaitingInteractionError`를 던져 오류가 아니라 "아직 아무도 요청하지 않음"으로
 * 다루게 한다.
 */
export async function fetchOverallAnalysis(
    { intent, reasoning, ...target }: FetchOverallAnalysisRequest,
    messages: StreamErrorMessages,
    signal?: AbortSignal
): Promise<WithPlain<OverallAnalysisResponse>> {
    const result = await runAnalysisStream<RunOverallAnalysisActionResult>({
        type: 'overall',
        params: { ...target, reasoning, ...INTENT_PARAMS[intent] },
        signal,
        messages,
    });

    if (result.status === 'reanalyze_cooldown') {
        // 재분석 버튼 연타로 자주 뜨는 정상 경로라 카탈로그 문구를 쓴다.
        throw new OverallCooldownError(
            messages.reanalyzeCooldown(Math.ceil(result.remainingMs / 1000))
        );
    }

    if (result.status === 'cached' || result.status === 'done')
        return { data: result.result, plain: readPlain(result) };

    // 캐시 전용 조회가 미스였다 — 오류가 아니라 사용자가 누를 때까지의 대기다.
    // 생성을 요구한 요청이 이 상태를 받는 것은 서버 계약 위반이므로 아래의
    // 예상 밖 응답으로 떨어뜨린다.
    if (result.status === 'miss_no_trigger' && intent === 'cache')
        throw new AwaitingInteractionError();

    if (result.status === 'error') {
        if (isGateBlockedResult(result))
            throw new OverallAnalysisError(result.error.message);
        // core가 채우는 `result.error`는 로케일과 무관한 영어라 화면에 쓰지 않고
        // 개발자용으로 콘솔에만 남긴다.
        if (typeof result.error === 'string')
            console.error('[overallAnalysisFailed]', result.error);
        throw new OverallAnalysisError(messages.analysisFailed, result.axis);
    }

    // core가 만든 한도·키 문구는 로케일 고정(영어·한국어)이라 코드만 믿는다.
    if (result.status === 'limit_error')
        throw new OverallAnalysisError(messages.limitExceeded);
    if (result.status === 'key_error')
        throw new OverallAnalysisError(messages.keyRequired);

    throw new OverallAnalysisError(messages.unexpected);
}
