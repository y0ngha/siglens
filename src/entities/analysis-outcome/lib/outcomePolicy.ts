import type { Timeframe } from '@y0ngha/siglens-core';
import type { FailureKind, UnlabelableReason } from '../types';
import {
    MS_PER_DAY,
    MS_PER_HOUR,
    MS_PER_MINUTE,
    MS_PER_SECOND,
} from '@/shared/config/time';

/** `analysis_outcomes` 보존 기간(일), `generated_at` 기준. `analysis_history`는 90일이라 일부러 더 길다. */
export const OUTCOME_RETENTION_DAYS = 730;

/**
 * 캡처가 보는 `analysis_history` 창(일). `prompt_dynamic`이 7일 뒤 비워지므로 6일이면 그 안에서 읽는다.
 * 배포 전 행은 일부러 채우지 않는다(역채움 없음).
 */
export const CAPTURE_LOOKBACK_DAYS = 6;

/** 한 실행이 캡처하는 행 상한. 캡처는 DB만 쓴다(외부 호출·종목 해석 없음). */
export const CAPTURE_BATCH = 500;

/**
 * 캡처가 한 번에 읽는 행 수. 한 행이 `result`(약 30KB)와 `prompt_dynamic`(수십 KB)을 달고 오므로 500행을 한
 * 쿼리로 읽으면 한 tick에 30~60MB가 된다. 이 크기로 나눠 읽고 청크 사이에서 마감을 본다.
 */
export const CAPTURE_CHUNK = 100;

/**
 * 캡처가 못 가져간 가장 오래된 분석이 이만큼(일) 넘게 묵으면 `[analysis-outcomes] capture backlog`를 남긴다.
 * 창(`CAPTURE_LOOKBACK_DAYS`)이 6일이라 이 값을 넘긴 행은 곧 조용히 창 밖으로 밀려 영영 못 가져온다.
 */
export const CAPTURE_BACKLOG_WARN_DAYS = 5;

/** 한 실행이 봉을 로드하는 (symbol, timeframe) 그룹 상한. 외부 요청 상한이다. */
export const MAX_GROUPS_PER_RUN = 120;

/** 동시에 봉을 로드하는 그룹 수(CC-1). */
export const BARS_CONCURRENCY = 2;

/** 그룹 하나의 봉 로드 타임아웃(CC-5). 락 TTL 계산에 들어간다. */
export const GROUP_TIMEOUT_MS = 20_000;

/** 한 그룹에서 한 번에 라벨하는 행 상한. 남은 행은 여전히 due라 다음 tick이 잇는다. */
export const ROWS_PER_GROUP_LIMIT = 200;

/** 한 실행이 재라벨하는 행 상한(공급자 호출 없음). */
export const RELABEL_BATCH = 500;

/** 한 실행이 지우는 행 상한(`id IN (SELECT … LIMIT)`). */
export const PRUNE_BATCH = 500;

/** 봉이 모자라 미룰 때의 최소 대기. */
export const MIN_DEFER_MS = MS_PER_HOUR;

/** 그룹 봉 로드 실패 뒤 재시도까지 대기. */
export const GROUP_FAILURE_RETRY_MS = 6 * MS_PER_HOUR;

/** 그룹 봉 로드가 이만큼 실패한 행은 `bars_unavailable`로 포기한다. */
export const MAX_GROUP_FAILURES = 8;

/**
 * 행 하나를 처리하다 던진 뒤 재시도까지 대기. 이 백오프가 없으면 매번 던지는 행이 자기 그룹을 줄 맨 앞에
 * 영원히 붙들어 두어 실행마다 봉 로드 한 번과 그룹 자리 하나(`MAX_GROUPS_PER_RUN`)를 먹는다.
 */
export const ROW_FAILURE_RETRY_MS = 6 * MS_PER_HOUR;

/** 행 처리 오류가 이만큼 쌓인 행은 `label_error`로 포기한다. */
export const MAX_ROW_FAILURES = 5;

/**
 * `anchor_missing`은 앵커 봉이 정말 없을 때뿐 아니라 창이 읽는 앞 봉 하나가 검증을 통과하지 못할 때도
 * 나온다(제공자의 일시 결측이나 하루 뒤 정정). 한 번 관측으로 포기하지 않고 하루 간격으로 이만큼 보고 포기한다.
 */
export const MAX_ANCHOR_MISSING_OBSERVATIONS = 3;
export const ANCHOR_MISSING_RETRY_MS = MS_PER_DAY;

/**
 * `insufficient_forward`의 `have`가 **처음 자라지 않은 시각부터** 이만큼 지나도 계속 자라지 않으면
 * 포기한다(`forward_stalled`). 10일은 거래소 최장 연속 휴장(연말연시·임시공휴일 포함)보다 길어서 정상 휴장에
 * 걸리지 않고(`marketSessionDate`의 되감기 상한과 같은 근거), 상장폐지·거래정지는 확실히 잡는다. 시도 횟수가
 * 아니라 시간으로 정하는 이유: 일봉은 시도 간격이 며칠이고 분봉은 시간 단위라, 횟수는 주말만으로도 오판한다.
 */
export const STALL_GIVE_UP_MS = 10 * MS_PER_DAY;

/** `have`가 자라지 않는 동안의 재시도 간격. 포기 판정이 `STALL_GIVE_UP_MS`를 하루 넘게 넘기지 않게 한다. */
export const STALLED_RETRY_MS = MS_PER_DAY;

/**
 * 캡처하지 않는 타임프레임. 형성 중 봉 제거(`closedBars`)와 앵커 마감 시각(`buildOutcomeAnchor`)은 일봉의 세션
 * 규칙과 분봉의 "시작 + 봉 길이" 규칙만 안다. 주봉(`1Week`)은 둘 다에 맞지 않으므로 규칙을 정하기 전에는
 * 이력 행을 아예 가져가지 않는다(캡처 조건에서 빼서 `captureRemaining`·밀림 경고에도 세지 않는다).
 */
export const UNCAPTURED_TIMEFRAMES = [
    '1Week',
] as const satisfies readonly Timeframe[];

/** 라벨러가 다루는 타임프레임 — core `Timeframe`에서 {@link UNCAPTURED_TIMEFRAMES}를 뺀 것. */
export type OutcomeTimeframe = Exclude<
    Timeframe,
    (typeof UNCAPTURED_TIMEFRAMES)[number]
>;

/** 분봉 봉이 닫힌 뒤 제공자 발행을 기다리는 시간(분). 일봉은 `lastClosedSessionDate`의 EOD 버퍼를 쓴다. */
export const INTRADAY_SETTLE_MINUTES = 35;

/**
 * 타임프레임별 봉 길이(분). core `TIMEFRAME_MINUTES`는 공개 export가 아니라 여기 둔다 — 값은
 * `outcomeEarliestLabelTime`과 `insufficient_forward.need`에 대한 테스트(`outcomePolicy.test.ts`)가 core와 맞춘다.
 */
export const BAR_MINUTES: Readonly<Record<OutcomeTimeframe, number>> = {
    '5Min': 5,
    '15Min': 15,
    '30Min': 30,
    '1Hour': 60,
    '4Hour': 240,
    '1Day': 24 * 60,
};

export function isTimeframe(value: string): value is OutcomeTimeframe {
    return Object.hasOwn(BAR_MINUTES, value);
}

export function barSeconds(timeframe: OutcomeTimeframe): number {
    return (BAR_MINUTES[timeframe] * MS_PER_MINUTE) / MS_PER_SECOND;
}

/**
 * The one place that says what a failure kind is: the counter column it increments (a key of `analysis_outcomes`) and
 * the reason the row gives up with. The counters are separate so one kind's history never shortens another's patience;
 * the limit of each kind is the `MAX_*` constant the caller passes. A new `FailureKind` fails to compile until it has
 * an entry here.
 */
export const FAILURE_SPEC = {
    load: { counter: 'loadFailures', giveUpReason: 'bars_unavailable' },
    row: { counter: 'rowErrors', giveUpReason: 'label_error' },
    anchor_missing: {
        counter: 'anchorMissingSeen',
        giveUpReason: 'anchor_missing',
    },
} as const satisfies Record<
    FailureKind,
    {
        counter: 'loadFailures' | 'rowErrors' | 'anchorMissingSeen';
        giveUpReason: UnlabelableReason;
    }
>;

export type ForwardDecision =
    | {
          kind: 'defer';
          nextAttemptAt: Date;
          forwardHave: number;
          stalledSince: Date | null;
      }
    | { kind: 'give_up' };

export interface ForwardDecisionInput {
    have: number;
    need: number;
    timeframe: OutcomeTimeframe;
    now: Date;
    /** 지난번에 기록한 `have`; 첫 시도면 `null`. */
    previousHave: number | null;
    previousStalledSince: Date | null;
}

/**
 * `insufficient_forward` 결과로 다음 시도를 정한다.
 *
 * - `have`가 늘었다(또는 첫 관측): 정체 표시를 지우고 `max(1시간, (need − have) × 봉 길이)` 뒤에 다시 본다.
 * - 늘지 않았다: 처음 늘지 않은 시각(`stalledSince`)을 기록하고 하루 뒤에 다시 본다. 그 시각부터
 *   `STALL_GIVE_UP_MS`가 지나도 그대로면 포기한다.
 */
export function decideInsufficientForward(
    input: ForwardDecisionInput
): ForwardDecision {
    const { have, need, timeframe, now, previousHave, previousStalledSince } =
        input;
    if (previousHave === null || have > previousHave) {
        const waitMs = Math.max(
            MIN_DEFER_MS,
            (need - have) * BAR_MINUTES[timeframe] * MS_PER_MINUTE
        );
        return {
            kind: 'defer',
            nextAttemptAt: new Date(now.getTime() + waitMs),
            forwardHave: have,
            stalledSince: null,
        };
    }
    const stalledSince = previousStalledSince ?? now;
    if (now.getTime() - stalledSince.getTime() >= STALL_GIVE_UP_MS) {
        return { kind: 'give_up' };
    }
    return {
        kind: 'defer',
        nextAttemptAt: new Date(now.getTime() + STALLED_RETRY_MS),
        forwardHave: previousHave,
        stalledSince,
    };
}
