import type { ModelId, Timeframe } from '@y0ngha/siglens-core';

/**
 * 이 SSE 라우트가 받는 분석 종류. `technical`만 전용 핸들러(`handleTechnicalStream`)가 맡고
 * 나머지는 `DISPATCH` 표로 보낸다.
 */
export type AnalysisType =
    | 'technical'
    | 'overall'
    | 'fundamental'
    | 'financials'
    | 'news'
    | 'marketNewsDigest'
    | 'options'
    | 'congress'
    | 'investorFlows'
    | 'briefing'
    | 'macroBriefing';

/** `DISPATCH` 표가 처리하는 종류 — `technical`을 뺀 나머지. */
export type DispatchedAnalysisType = Exclude<AnalysisType, 'technical'>;

/** `technical` 요청 본문의 `params`. 각 필드의 검증은 게이트·core가 맡는다. */
export interface TechnicalParams {
    symbol: string;
    companyName: string;
    timeframe: Timeframe;
    fmpSymbol?: string;
    modelId?: ModelId;
    /**
     * 클라이언트가 요청한 deep-thinking 토글. 회원/프로 등급에게만 적용된다 —
     * `resolveReasoning`이 비회원·free에게는 값과 무관하게 `false`로 고정한다.
     */
    reasoning?: boolean;
    /**
     * 사용자가 "재분석"을 누른 요청이라는 **의도** 표시. 캐시 우회(`force`) 자체가
     * 아니다 — 실제 우회 여부는 서버가 재분석 쿨다운을 획득했는지로 정한다.
     * 그래서 이 값을 믿어도 (symbol, timeframe)당 5분에 한 번 이상 LLM을 태울 수 없다.
     */
    reanalyze?: boolean;
    /**
     * 캐시만 읽고 미스면 생성하지 않는다(`miss_no_trigger`). 큐레이션 밖 종목에서
     * 첫 신뢰 입력 전에 클라이언트가 보낸다(`useAiAutoRunAllowed`). 생략·`false`면
     * 지금과 같은 동작이라 클라이언트가 이 값을 속여도 새 비용 경로가 생기지 않는다.
     */
    cacheOnly?: boolean;
}

/** `technical` 이외 종류의 `params`. 종류마다 모양이 달라 위임받은 액션이 검증한다. */
export type DispatchParams = Record<string, unknown>;

/** 검증을 통과한 요청 본문. 라우트가 종류별 핸들러로 가르는 기준이다. */
export type ParsedStreamBody =
    | { kind: 'technical'; params: TechnicalParams }
    | {
          kind: 'dispatch';
          type: DispatchedAnalysisType;
          params: DispatchParams;
      };

/**
 * 생성 한도가 디스패치 핸들러에 넘기는 값. 한도 초과면 `cacheOnly`가 켜져 캐시만
 * 조회하고, 재분석(캐시 우회 = 새 생성) 의도도 무시한다.
 */
export interface DispatchQuotaContext {
    /** 클라이언트의 `cacheOnly` 요청 **또는** 한도 초과 강등. */
    readonly cacheOnly: boolean;
    readonly rateLimited: boolean;
    /** core가 프롬프트를 조립했을 때 부른다 — 생성 여부 판정(`promptAssembledProbe`). */
    readonly onPromptAssembled: () => void;
}
