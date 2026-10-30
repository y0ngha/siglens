import 'server-only';
import type { RedisLease } from '@/shared/cache/createRedisLease';
import type { PlainTextRepository } from '@/shared/db/types';
import { sleep } from '@/shared/lib/sleep';
import { fireAndForget } from '@/shared/lib/backgroundTask';
import {
    hasPlainGenerationFailedRecently,
    markPlainGenerationFailed,
    releasePlainGenerationLock,
    tryAcquirePlainGenerationLock,
    type PlainGenerationKey,
} from '../plainGenerationCoordination';
import { findStored } from './plainStore';

/** 다른 인스턴스가 생성 중일 때 저장소를 다시 보는 간격(ms). */
const PLAIN_WAIT_POLL_INTERVAL_MS = 1_000;

/**
 * 다른 인스턴스의 생성을 기다리는 최대 시간(ms). 정상 생성(재시도 포함)을 담을 만큼만
 * 기다린다. 넘기면 락을 한 번 더 잡아 보고, 잡히면(보유자가 죽었거나 끝났는데 결과가 안
 * 들어왔다) 직접 생성한다.
 *
 * 보유자의 생성이 이보다 오래 걸려 락이 아직 살아 있으면(`held`) 중복 생성하지 않고
 * 물러난다 — 락 TTL이 호출 마감 두 번을 덮기 때문이다. 이 생성을 기다리는 호출자
 * **전원의 마감**이 먼저 지나면 그 자리에서 물러난다 — 받을 사람이 없는 폴링·생성은
 * 하지 않는다.
 */
const PLAIN_WAIT_MAX_MS = 25_000;

/**
 * 진행 중인 평이화 한 건. 두 프라미스 모두 **reject하지 않는다**.
 *
 * - `result`: 생성 전체(재시도·도려내기 포함)의 최종 글. 실패면 `null`.
 * - `softDraft`: 첫 시도가 연성 실패(`stale_deixis`)였다면 그 글, 아니면 `null`. 마감을 넘긴
 *   호출자가 물러날 때 쓴다(`rewriteToPlainLanguage` 끝부분).
 */
export interface PlainFlight {
    readonly result: Promise<string | null>;
    readonly softDraft: Promise<string | null>;
}

export const NULL_TEXT: Promise<string | null> = Promise.resolve(null);
const NO_FLIGHT: PlainFlight = { result: NULL_TEXT, softDraft: NULL_TEXT };

/** 저장소가 없어 락을 잡지 않은 생성 — 풀 것이 없다. */
const NO_LEASE: RedisLease = { status: 'unavailable' };

/**
 * 프로세스 안 single-flight. 키는 저장 키와 같은 좌표다.
 *
 * core의 `dedupeInFlight`가 한 분석 결과를 대기자 N명에게 나눠 주면, 그 N개 요청이 거의
 * 동시에 이 함수에 들어와 전부 저장소 미스를 보고 같은 평이화를 N번 불렀다(2026-10 비용
 * 감사 M3) — `ON CONFLICT DO NOTHING`은 중복 쓰기만 흡수할 뿐 지출은 막지 못한다.
 * 인스턴스 사이는 Redis 락(`plainGenerationCoordination.ts`)이 맡는다.
 *
 * 항목은 `result`가 끝나는 즉시 지운다. 각 호출자는 같은 `result`에 **자기 마감**을 따로
 * 건다 — 사용자 경로(15초)와 프리웜(30초)이 한 생성을 공유해도 서로의 마감에 묶이지 않는다.
 * 대신 `waitUntil`에 합류한 호출자 중 가장 늦은 마감(epoch ms)을 적어 두고, 다른 인스턴스를
 * 기다리는 폴링은 그 시각이 지나면 멈춘다.
 */
interface PlainFlightEntry {
    readonly flight: PlainFlight;
    readonly waitUntil: { at: number };
}

const plainFlights = new Map<string, PlainFlightEntry>();

const flightIdOf = (key: PlainGenerationKey): string =>
    `${key.promptVersion}:${key.locale}:${key.inputDigest}`;

/** @internal 테스트 전용 — 진행 중 항목을 비운다(beforeEach). */
export function __resetPlainFlightsForTests(): void {
    plainFlights.clear();
}

type WaitOutcome =
    | { readonly kind: 'found'; readonly text: string }
    | { readonly kind: 'failed' }
    /** 기다리는 호출자 전원의 마감이 지났다. */
    | { readonly kind: 'abandoned' }
    /** `PLAIN_WAIT_MAX_MS` 안에 결과도 실패 표시도 안 왔다. */
    | { readonly kind: 'timed_out' };

/**
 * 다른 인스턴스가 생성 중이다 — 직접 부르지 않고 그 결과가 저장소에 들어오기를 잠깐 기다린다.
 * 그쪽이 실패를 표시하면 곧바로 물러난다.
 */
async function waitForStored(
    repository: PlainTextRepository,
    key: PlainGenerationKey,
    waitUntil: () => number
): Promise<WaitOutcome> {
    for (
        let waited = 0;
        waited < PLAIN_WAIT_MAX_MS;
        waited += PLAIN_WAIT_POLL_INTERVAL_MS
    ) {
        if (Date.now() >= waitUntil()) return { kind: 'abandoned' };
        await sleep(PLAIN_WAIT_POLL_INTERVAL_MS);
        const stored = await findStored(
            repository,
            key.locale,
            key.inputDigest
        );
        if (typeof stored === 'string' && stored.length > 0)
            return { kind: 'found', text: stored };
        if (await hasPlainGenerationFailedRecently(key))
            return { kind: 'failed' };
    }
    return { kind: 'timed_out' };
}

/**
 * 이 프로세스가 생성을 맡는다. 끝나면 결과가 `null`일 때 실패를 표시하고, 실제로 잡은 락
 * (`acquired`)만 푼다 — fail-open(`unavailable`)은 잡은 것이 없어 풀지 않는다. 표시가 어떻게
 * 끝나든 락은 반드시 푼다(try/finally).
 */
function runOwnedGeneration(
    key: PlainGenerationKey,
    lease: RedisLease,
    generate: () => PlainFlight
): PlainFlight {
    const flight = generate();
    const cleanup = flight.result
        .then(async text => {
            try {
                if (text === null) await markPlainGenerationFailed(key);
            } finally {
                if (lease.status === 'acquired')
                    await releasePlainGenerationLock(lease);
            }
        })
        .catch((error: unknown) => {
            console.error('[analysisPlain] lock cleanup failed', error);
        });
    // SIGTERM 드레인(`drainBackgroundTasks`)에 등록한다. 등록 대상이 생성 + 락 해제까지의
    // 정리 체인이라, 종료 시 드레인이 락이 풀릴 때까지 기다린다. 등록하지 않으면 프로세스가
    // 락을 쥔 채 죽어 `PLAIN_LOCK_TTL_SECONDS` 동안 다른 요청이 사용자 마감까지 기다리다
    // 원본으로 물러난다. 호출 상한(`PLAIN_CALL_TIMEOUT_MS`)이 드레인 예산
    // (`SHUTDOWN_DRAIN_DEADLINE_MS`)보다 짧아 호출 하나의 대기는 예산을 넘기지 않는다.
    // 락을 SIGTERM에서 따로 푸는 방식은 쓰지 않는다 —
    // 생성 중인 호출이 살아 있는데 락만 풀면 다른 인스턴스가 중복 생성·중복 과금한다.
    fireAndForget(cleanup);
    return flight;
}

/**
 * 락을 쥔 인스턴스를 기다린다. 기다림이 시간 초과로 끝나면 락을 한 번만 다시 잡아 보고,
 * 잡히면 직접 생성한다(보유자가 죽어 TTL로 풀렸거나, 끝났는데 저장이 실패한 경우).
 */
async function waitOrTakeOver(
    key: PlainGenerationKey,
    repository: PlainTextRepository,
    waitUntil: () => number,
    generate: () => PlainFlight
): Promise<string | null> {
    const waited = await waitForStored(repository, key, waitUntil);
    if (waited.kind === 'found') return waited.text;
    if (waited.kind !== 'timed_out') return null;
    const lease = await tryAcquirePlainGenerationLock(key);
    if (lease.status === 'held') {
        console.warn('[analysisPlain] gave up waiting for another instance', {
            locale: key.locale,
            ms: PLAIN_WAIT_MAX_MS,
        });
        return null;
    }
    return runOwnedGeneration(key, lease, generate).result;
}

/**
 * 인스턴스 사이 조율. 순서가 곧 정책이다:
 *
 * 1. 최근 실패 표시가 있으면 부르지 않는다(음성 캐시) — 같은 입력이 같은 식으로 실패하는
 *    경우(가드 위반 등) 조회마다 1~2회씩 다시 과금되던 자리다.
 * 2. 락을 못 잡으면 다른 인스턴스가 생성 중이다 — 기다린다(`waitOrTakeOver`).
 * 3. 락을 잡았거나 Redis를 쓸 수 없으면(fail-open) 생성한다(`runOwnedGeneration`).
 *
 * 저장소가 없으면(`repository === null`) 락을 잡지 않는다 — 기다려도 읽을 곳이 없다.
 */
export async function coordinatePlainGeneration(
    key: PlainGenerationKey,
    repository: PlainTextRepository | null,
    waitUntil: () => number,
    generate: () => PlainFlight
): Promise<PlainFlight> {
    if (await hasPlainGenerationFailedRecently(key)) return NO_FLIGHT;
    if (repository === null) return runOwnedGeneration(key, NO_LEASE, generate);
    const lease = await tryAcquirePlainGenerationLock(key);
    if (lease.status !== 'held')
        return runOwnedGeneration(key, lease, generate);
    return {
        result: waitOrTakeOver(key, repository, waitUntil, generate),
        softDraft: NULL_TEXT,
    };
}

/**
 * 같은 좌표의 진행 중 평이화가 있으면 그것에 합류하고(마감을 늘려 적는다), 없으면
 * `start()`로 새로 시작해 등록한다. `start()`가 던져도 `null`로 떨어진다 — `PlainFlight`의
 * "reject하지 않는다" 계약.
 */
export function joinPlainFlight(
    key: PlainGenerationKey,
    deadlineAt: number,
    start: (waitUntil: () => number) => Promise<PlainFlight>
): PlainFlight {
    const id = flightIdOf(key);
    const existing = plainFlights.get(id);
    if (existing !== undefined) {
        existing.waitUntil.at = Math.max(existing.waitUntil.at, deadlineAt);
        return existing.flight;
    }
    const waitUntil = { at: deadlineAt };
    const begun = start(() => waitUntil.at);
    const flight: PlainFlight = {
        result: begun.then(
            f => f.result,
            () => null
        ),
        softDraft: begun.then(
            f => f.softDraft,
            () => null
        ),
    };
    plainFlights.set(id, { flight, waitUntil });
    void flight.result.finally(() => plainFlights.delete(id));
    return flight;
}
