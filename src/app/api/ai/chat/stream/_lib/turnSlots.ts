import { MAX_CONCURRENT_FRESH } from '@/app/api/ai/chat/tools/runFreshAnalysis';

/**
 * 인스턴스당 동시에 "일하는" 에이전트 턴의 상한. 카운터는 프로세스(인스턴스)
 * 단위 모듈 상태라 인스턴스 사이에 공유되지 않고, 모듈이 다시 평가되면(새
 * 인스턴스·HMR) 0에서 다시 센다. 인스턴스 전체를 묶는 상한이 아니다.
 *
 * 새 분석({@link TurnSlot.park}) 결과만 기다리는 턴은 모델도 도구도 돌리지 않으므로
 * 이 수에서 빠진다. 그래서 "일하는 턴" = 들어온 턴 − 주차한 턴이다.
 */
export const MAX_ACTIVE_AGENT_TURNS = 4;

/**
 * 주차한 턴까지 합친 들어온 턴의 하드 상한 = 일하는 4 + 새 분석 슬롯 수. 새 분석 슬롯이
 * 인스턴스당 `MAX_CONCURRENT_FRESH`개뿐이라, 주차 턴이 그보다 많아질 수 없다.
 */
export const MAX_ADMITTED_AGENT_TURNS =
    MAX_ACTIVE_AGENT_TURNS + MAX_CONCURRENT_FRESH;

/** 자리가 날 때까지 줄을 서 기다릴 수 있는 요청 수. 넘으면 곧바로 거절한다. */
export const AGENT_TURN_QUEUE_MAX = 8;

/** 줄에서 기다리는 최대 시간. 넘으면 `queue_timeout`으로 거절한다. */
export const AGENT_TURN_QUEUE_WAIT_MS = 15_000;

/** 분석 스트림 수는 이 모듈 밖에서 바뀌므로 줄이 비어 있지 않은 동안 이 간격으로 맨 앞을 다시 본다. */
const QUEUE_RECHECK_MS = 1_000;

export type BusyReason =
    | 'agent_turn_slots'
    | 'analysis_stream_slots'
    | 'queue_full'
    | 'queue_timeout';

/** 거절 때 어느 쪽 상한이 막고 있었는지 — 알람 로그의 `reason`이 큐 사유로 바뀌어도 원인은 남긴다. */
export type BlockedBy = 'agent_turn_slots' | 'analysis_stream_slots';

export interface TurnSlot {
    /** 슬롯을 돌려준다. 몇 번 불러도 한 번만 줄어든다. */
    release(): void;
    /**
     * 새 분석 결과만 기다리는 동안 "일하는 턴" 수에서 이 턴을 뺀다. 중첩해서 부를 수 있고(분석
     * 최대 3건 동시), 돌려받은 `unpark`는 멱등이다. 풀어도 다른 대기자를 밀어내지 않는다 — 하드
     * 상한({@link MAX_ADMITTED_AGENT_TURNS})만 지킨다.
     */
    park(): () => void;
}

export type AcquireResult =
    | { ok: true; slot: TurnSlot; waitedMs: number }
    | {
          ok: false;
          reason: BusyReason | 'aborted';
          blockedBy: BlockedBy;
          waitedMs: number;
      };

export interface AcquireOptions {
    signal: AbortSignal;
    /** 분석 스트림 슬롯이 남았는지. 줄 맨 앞 요청이 들어올 때마다 다시 묻는다. */
    canAcceptStream: () => boolean;
    now?: () => number;
}

interface Waiter {
    canAcceptStream: () => boolean;
    settle: (result: AcquireResult) => void;
    /** 결과를 내지 않고 타이머·abort 리스너만 정리하고 줄에서 뺀다(테스트 초기화용). */
    dispose: () => void;
}

let admitted = 0;
let parked = 0;
const queue: Waiter[] = [];
let recheck: ReturnType<typeof setInterval> | null = null;

/** 현재 인스턴스에서 일하는(주차하지 않은) 턴 수 — 용량 거절 로그에 싣는다. */
export function getActiveAgentTurns(): number {
    return admitted - parked;
}

/** 줄 서 있는 요청 수 — 용량 거절 로그에 싣는다. */
export function getQueuedAgentTurns(): number {
    return queue.length;
}

function hasRoom(canAcceptStream: () => boolean): boolean {
    return (
        admitted - parked < MAX_ACTIVE_AGENT_TURNS &&
        admitted < MAX_ADMITTED_AGENT_TURNS &&
        canAcceptStream()
    );
}

function blockedByNow(canAcceptStream: () => boolean): BlockedBy {
    return canAcceptStream() ? 'agent_turn_slots' : 'analysis_stream_slots';
}

function stopRecheckIfIdle(): void {
    if (queue.length === 0 && recheck !== null) {
        clearInterval(recheck);
        recheck = null;
    }
}

function startRecheck(): void {
    recheck ??= setInterval(drain, QUEUE_RECHECK_MS);
}

function createSlot(): TurnSlot {
    let released = false;
    let parkDepth = 0;
    return {
        release: () => {
            if (released) return;
            released = true;
            if (parkDepth > 0) parked -= 1;
            parkDepth = 0;
            admitted -= 1;
            drain();
        },
        park: () => {
            if (released) return () => {};
            parkDepth += 1;
            if (parkDepth === 1) {
                parked += 1;
                drain();
            }
            let unparked = false;
            return () => {
                if (unparked || released) return;
                unparked = true;
                parkDepth -= 1;
                if (parkDepth === 0) parked -= 1;
            };
        },
    };
}

/** 줄 맨 앞부터 자리가 나는 만큼 들여보낸다(FIFO). 맨 앞이 못 들어가면 뒤도 기다린다. */
function drain(): void {
    while (queue.length > 0 && hasRoom(queue[0].canAcceptStream)) {
        const head = queue[0];
        admitted += 1;
        // `settle`이 줄에서 빼고 타이머를 정리한다.
        head.settle({ ok: true, slot: createSlot(), waitedMs: 0 });
    }
    stopRecheckIfIdle();
}

/**
 * 에이전트 턴 슬롯을 받는다. 자리가 있고 줄이 비어 있으면 곧바로 받고, 아니면 최대
 * {@link AGENT_TURN_QUEUE_WAIT_MS} 동안 줄에서 기다린다(최대 {@link AGENT_TURN_QUEUE_MAX}명). 줄이
 * 차 있으면 기다리지 않고 거절한다. 확인과 예약 사이에 `await`이 없다(CC-10).
 */
export function acquireTurnSlot({
    signal,
    canAcceptStream,
    now = Date.now,
}: AcquireOptions): Promise<AcquireResult> {
    const refuse = (
        reason: BusyReason | 'aborted',
        waitedMs = 0
    ): AcquireResult => ({
        ok: false,
        reason,
        blockedBy: blockedByNow(canAcceptStream),
        waitedMs,
    });
    if (signal.aborted) return Promise.resolve(refuse('aborted'));
    if (queue.length === 0 && hasRoom(canAcceptStream)) {
        admitted += 1;
        return Promise.resolve({ ok: true, slot: createSlot(), waitedMs: 0 });
    }
    if (queue.length >= AGENT_TURN_QUEUE_MAX)
        return Promise.resolve(refuse('queue_full'));

    return new Promise<AcquireResult>(resolve => {
        const enqueuedAt = now();
        const cleanup = (): void => {
            clearTimeout(timer);
            signal.removeEventListener('abort', onAbort);
            const at = queue.indexOf(waiter);
            if (at !== -1) queue.splice(at, 1);
            stopRecheckIfIdle();
        };
        const waiter: Waiter = {
            canAcceptStream,
            settle: result => {
                cleanup();
                resolve(
                    result.ok
                        ? { ...result, waitedMs: now() - enqueuedAt }
                        : result
                );
            },
            dispose: () => cleanup(),
        };
        // 맨 앞이 나가면 뒤 대기자가 새 맨 앞이 된다 — 자리가 이미 나 있으면 1초 재확인을
        // 기다리지 않고 바로 들여보낸다.
        const leave = (reason: 'aborted' | 'queue_timeout'): void => {
            waiter.settle(refuse(reason, now() - enqueuedAt));
            drain();
        };
        const onAbort = (): void => leave('aborted');
        const timer = setTimeout(
            () => leave('queue_timeout'),
            AGENT_TURN_QUEUE_WAIT_MS
        );
        signal.addEventListener('abort', onAbort, { once: true });
        queue.push(waiter);
        startRecheck();
    });
}

/** 테스트 전용 — 모듈 상태를 비운다(줄에 남은 대기자는 타이머·abort 리스너를 정리하고 버린다). */
export function __resetTurnSlotsForTests(): void {
    [...queue].forEach(waiter => waiter.dispose());
    queue.splice(0);
    admitted = 0;
    parked = 0;
    if (recheck !== null) clearInterval(recheck);
    recheck = null;
}
