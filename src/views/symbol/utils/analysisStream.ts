/**
 * `useAnalysis` SSE 제출 계약 중 React와 무관한 부분 — 결과를 onSuccess/onError로 가르는 규칙과
 * 쿨다운 값. 훅 없이 단위 테스트한다(`views/symbol/__tests__/utils/analysisStream.test.ts`).
 */
import {
    TIER_CONFIG,
    type ModelId,
    type RunAnalysisResult,
    type TierInfoDepth,
    type Timeframe,
} from '@y0ngha/siglens-core';
import { MS_PER_MINUTE, MS_PER_SECOND } from '@/shared/config/time';
import type { StreamErrorMessages } from '@/shared/lib/sse/runAnalysisStream';
import type {
    AnalysisGateBlockedResult,
    AnalysisMeter,
} from '@/shared/lib/types';

/**
 * Final return type for the technical analysis SSE stream — core's gated
 * result extended with `personalized`, or a siglens-side gate error.
 *
 * `personalized` is a server-authoritative flag: true when the server
 * used a position-bucket cache key for THIS submission. Optional because
 * `AnalysisGateBlockedResult` never carries it.
 */
export type RunAnalysisActionResult =
    | (RunAnalysisResult & {
          personalized?: boolean;
          /**
           * 평이화("쉽게보기") 산문. SSE 라우트의 `withReaderViews`가 붙인다.
           *
           * `null`은 재작성 실패(가드 거부·마감 초과·설정 없음)를 뜻하고,
           * `undefined`는 롤링 배포 중 구버전 인스턴스가 필드 자체를 안 보낸 경우다.
           * 둘 다 "원본만 보여준다"로 같게 처리한다.
           */
          plain?: string | null;
          /**
           * 비회원 하루 무료 전체 공개 미터 판정. 필드가 없으면 미터가 적용되지 않은
           * 응답이다(회원·정책 없음·크롤러·저장소 장애, 롤링 배포 중 구버전 인스턴스).
           */
          meter?: AnalysisMeter;
      })
    | AnalysisGateBlockedResult
    /**
     * 재분석 의도로 보낸 요청인데 서버가 쿨다운을 획득하지 못했다 — 새 분석을
     * 태우지 않고 남은 시간만 알려준다. 쿨다운 획득은 서버가 단독으로 하므로
     * (클라이언트가 미리 잡으면 서버 획득이 반드시 실패한다) 이 응답이 클라이언트가
     * 쿨다운 상태를 알게 되는 유일한 경로다.
     */
    | { status: 'reanalyze_cooldown'; remainingMs: number };

/** 제출이 끝까지 돌려줄 수 있는(onSuccess에 닿는) 결과. 나머지 상태는 throw로 onError에 간다. */
export type AnalysisSubmitOutcome = Extract<
    RunAnalysisActionResult,
    { status: 'cached' | 'done' | 'reanalyze_cooldown' | 'miss_no_trigger' }
>;

/** `useAnalysis`의 mutation 변수. */
export interface AnalyzeMutationVariables {
    symbol: string;
    companyName: string;
    force: boolean;
    fmpSymbol?: string;
    modelId?: ModelId;
    reasoning?: boolean;
    /**
     * 캐시만 읽고 미스면 생성하지 않는다. 큐레이션 밖 종목의 첫 신뢰 입력 전,
     * 마운트 재시도에서만 쓴다(`useAnalysis`의 `autoRunAllowed` 옵션 참고).
     */
    cacheOnly?: boolean;
}

/**
 * 재분석 쿨다운 (5분).
 * 진실값은 Redis(서버)다. `useAnalysis`는 끝나는 시각만 들고, 남은 시간은 그것을 보여 주는
 * 컴포넌트가 표시 목적으로 센다(`useCountdownMs`).
 */
export const REANALYZE_COOLDOWN_MS = 5 * MS_PER_MINUTE;

/** 캐시 히트(force=false 즉시 응답) 시 적용하는 짧은 클라이언트 쿨다운 — 같은 캐시의 빠른 반복 호출 방지. */
export const CACHE_HIT_COOLDOWN_MS = 30 * MS_PER_SECOND;

/** 남은 ms를 끝나는 시각(epoch ms)으로 바꾼다. 0 이하는 쿨다운 없음(0). */
export function cooldownUntilFromNow(remainingMs: number): number {
    return remainingMs > 0 ? Date.now() + remainingMs : 0;
}

/** free가 허용하는 depth. */
const FREE_ALLOWED_INFO_DEPTH: ReadonlySet<TierInfoDepth> = new Set(
    TIER_CONFIG.infoDepth.free
);

/**
 * 자유 티어에서 잠기는 TierInfoDepth 전체 집합. core의 `TIER_CONFIG.infoDepth`(free/member/pro
 * allow-list)에서 직접 파생한다 — 로컬 리터럴로 유니온을 다시 나열하면 core가 depth를 추가하거나
 * free의 allow-list를 바꿀 때 조용히 드리프트한다(CONVENTIONS.md#TS-2). 세 tier allow-list의
 * 합집합이 전체 집합이고, 거기서 free가 허용하는 값을 뺀 것이 free가 잠그는 집합이다.
 */
export const FREE_LOCKED_INFO_DEPTH: readonly TierInfoDepth[] = Array.from(
    new Set(Object.values(TIER_CONFIG.infoDepth).flat())
).filter(depth => !FREE_ALLOWED_INFO_DEPTH.has(depth));

/** core 재시도 소진 sentinel — AI 제공자가 모든 재시도 뒤에도 불안정할 때 SSE 오류로 온다. */
const AI_SERVER_UNSTABLE = 'AI_SERVER_UNSTABLE';

/** 쿨다운이 가리키는 대상 키(`symbol|timeframe`). */
export function cooldownKeyOf(symbol: string, timeframe: Timeframe): string {
    return `${symbol}|${timeframe}`;
}

/**
 * 스트림 결과를 분류한다. `cached`·`done`·`reanalyze_cooldown`·`miss_no_trigger`만 돌려주고
 * 나머지는 사용자 문구를 담은 Error로 던져 onError에 닿게 한다. `miss_no_trigger`는 `cacheOnly`
 * 제출(AI 자동 실행 게이트가 닫힌 마운트 재시도)에만 오며 실패가 아니라 "입력 대기"다.
 */
export function toAnalysisOutcome(
    result: RunAnalysisActionResult,
    messages: StreamErrorMessages
): AnalysisSubmitOutcome {
    if (
        result.status === 'cached' ||
        result.status === 'done' ||
        result.status === 'reanalyze_cooldown' ||
        result.status === 'miss_no_trigger'
    ) {
        return result;
    }
    if (result.status === 'key_error') {
        // core가 만든 문구는 **전 로케일 한국어**라 쓰지 않는다.
        throw new Error(messages.keyRequired);
    }
    if (result.status === 'error') {
        const { error } = result;
        const message =
            typeof error === 'object' &&
            error !== null &&
            'message' in error &&
            typeof error.message === 'string'
                ? error.message
                : messages.generic;
        throw new Error(message);
    }
    throw new Error(messages.unexpected);
}

/**
 * SSE 단계에서 던져진 오류를 사용자 문구로 바꿔 다시 던진다. 결과 단계 오류는
 * `toAnalysisOutcome`이 이미 문구로 바꿨으므로 그대로 통과한다.
 */
export function rethrowStreamError(
    err: unknown,
    messages: StreamErrorMessages
): never {
    const message = err instanceof Error ? err.message : String(err);
    if (message === AI_SERVER_UNSTABLE) {
        throw new Error(messages.unstable);
    }
    throw err;
}
