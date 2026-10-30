import {
    INVESTOR_FLOWS_BASELINE_MIN_FILERS,
    INVESTOR_FLOWS_UPSERT_CHUNK_SIZE,
} from '../lib/investorFlowsPolicy';
import {
    isPeriodComplete,
    nextQuarterEnd,
    previousQuarterEnd,
    retainedPeriods,
} from '../lib/investorFlowsDates';
import type { AggregateMode } from '../api/aggregateSql';
import type {
    Ingest13fDeps,
    Ingest13fRepository,
    RunState,
} from './ingest13fTypes';

/** 집계 flush 한 번의 CUSIP 수(= 재계산 SQL 한 번). */
const DIRTY_FLUSH_CHUNK = INVESTOR_FLOWS_UPSERT_CHUNK_SIZE;
const stateKeyPeriodMode = (period: string): string =>
    `sec13f_period_mode:${period}`;

/**
 * `period`의 직전 분기를 비교 기준으로 쓸 수 있는지. 직전 분기 포지션이 보존 범위 안에 있고, 그 분기에
 * 반영된 필러가 충분해야(`INVESTOR_FLOWS_BASELINE_MIN_FILERS`) 한다 — 수집 범위 밖 정정 몇 건이나 덜 끝난
 * 백필을 기준으로 삼으면 모든 보유자가 "신규"로 잡힌다.
 */
export async function hasBaseline(
    repo: Pick<Ingest13fRepository, 'countProcessedFilersForPeriod'>,
    period: string,
    floor: string
): Promise<boolean> {
    const prev = previousQuarterEnd(period);
    return (
        prev >= floor &&
        (await repo.countProcessedFilersForPeriod(prev)) >=
            INVESTOR_FLOWS_BASELINE_MIN_FILERS
    );
}

/** 분기의 재계산 모드: 기준 없음 / 완결(전체 대 전체) / 진행 중(패널). */
export async function aggregateModeFor(
    repo: Pick<Ingest13fRepository, 'countProcessedFilersForPeriod'>,
    period: string,
    floor: string,
    today: string
): Promise<AggregateMode> {
    if (!(await hasBaseline(repo, period, floor))) return 'none';
    return isPeriodComplete(period, today) ? 'complete' : 'panel';
}

/**
 * 분기의 **계산 모드가 바뀌었는지** 확인해, 바뀌었으면 그 분기 집계 전체를 다시 계산하게 한다. 모드는 시간이 지나며
 * 바뀐다 — 진행 중 → 완결(마감 + 5일 경과)로 넘어가면 패널 비교가 전체 대 전체 비교로 바뀌고, 직전 분기 필러 수가
 * 1,000곳을 넘으면 기준 없음 → 기준 있음이 된다. 그런데 집계는 "바뀐 (period, cusip)"만 다시 계산하므로 아무것도
 * 건드리지 않으면 옛 모드로 계산된 행이 그대로 남아 **패널 집계가 완결로 채점**되고 `findExitedHolders`와 어긋난다.
 *
 * "마지막으로 이 분기를 어떤 모드로 표시(=재계산 대상으로 올림)했는지"를 `investor_flows_state`에 둔다(durable).
 * 저장값이 없으면(처음 보는 분기) 기록만 한다 — 그 분기 포지션은 반영될 때 이미 dirty이고 flush가 현재 모드로 계산한다.
 * 저장값과 다르면 그 분기의 **모든 CUSIP을 dirty로 표시**한 뒤(SQL 쪽에서, 메모리에 올리지 않는다) 상태를 갱신한다 —
 * 상태 갱신이 표시 **뒤**라 도중에 죽어도 다음 실행이 다시 표시한다(멱등).
 */
export async function reconcilePeriodModes(
    deps: Ingest13fDeps,
    floor: string,
    today: string
): Promise<void> {
    const { repo } = deps;
    // 일부러 직렬이다: 분기는 서로 독립이지만 `markPeriodDirty`가 같은 dirty 테이블에 큰 INSERT…SELECT를 쓰므로 한 번에
    // 하나씩 해야 DB 쓰기 부하와 로그 순서가 예측 가능하다(분기는 ~3개라 병렬로 얻는 시간도 없다).
    for (const period of retainedPeriods(floor, today)) {
        // react-doctor-disable-next-line react-doctor/async-await-in-loop
        const desired = await aggregateModeFor(repo, period, floor, today);
        const key = stateKeyPeriodMode(period);
        // react-doctor-disable-next-line react-doctor/async-await-in-loop
        const stored = await repo.getState(key);
        if (stored === desired) continue;
        if (stored !== null) {
            // react-doctor-disable-next-line react-doctor/async-await-in-loop
            const marked = await repo.markPeriodDirty(period);
            deps.log(
                `[sec-13f] aggregate mode of ${period} changed ${stored} -> ${desired}; ${marked} CUSIPs queued for recompute`
            );
        }
        // react-doctor-disable-next-line react-doctor/async-await-in-loop
        await repo.setState(key, desired);
    }
}

/**
 * dirty 큐를 비운다: 가장 오래된 분기부터 CUSIP 청크를 재계산(+ 다음 분기 — 그 분기의 신규/청산은 이 분기
 * 포지션이 기준이다)하고, **재계산이 끝난 뒤에야** 그 청크의 dirty 행을 지운다. 도중에 죽어도 남은 행은 다음
 * 실행이 처리한다(재계산은 멱등). `shouldStop`이 서면 남은 일을 그대로 두고 돌아온다.
 */
export async function flushDirty(
    deps: Ingest13fDeps,
    state: RunState,
    floor: string,
    today: string,
    shouldStop: () => boolean
): Promise<void> {
    const { repo } = deps;
    const modes = new Map<string, AggregateMode>();
    const modeOf = async (period: string): Promise<AggregateMode> => {
        const cached = modes.get(period);
        if (cached !== undefined) return cached;
        const mode = await aggregateModeFor(repo, period, floor, today);
        modes.set(period, mode);
        return mode;
    };
    for (;;) {
        if (shouldStop()) return;
        // 청크는 앞 청크의 clear 뒤에 읽어야 같은 행을 다시 읽지 않는다 — 직렬.
        // react-doctor-disable-next-line react-doctor/async-await-in-loop
        const batch = await repo.takeDirty(DIRTY_FLUSH_CHUNK);
        if (batch === null) return;
        const cusips = batch.entries.map(entry => entry.cusip);
        // react-doctor-disable-next-line react-doctor/async-await-in-loop
        await repo.recomputeAggregates(
            batch.period,
            cusips,
            await modeOf(batch.period)
        );
        // 청크 **안**에서도 시간 상자를 확인한다 — 다음 분기 재계산까지 하다 보면 한 청크가 길어진다. 멈추면 이 청크의
        // dirty는 지우지 않아(재계산은 멱등) 다음 실행이 이어 간다.
        if (shouldStop()) return;
        const next = nextQuarterEnd(batch.period);
        // react-doctor-disable-next-line react-doctor/async-await-in-loop
        if ((await repo.countProcessedFilersForPeriod(next)) > 0) {
            // react-doctor-disable-next-line react-doctor/async-await-in-loop
            await repo.recomputeAggregates(next, cusips, await modeOf(next));
        }
        // react-doctor-disable-next-line react-doctor/async-await-in-loop
        await repo.clearDirty(
            batch.period,
            batch.entries.map(entry => entry.id)
        );
        state.result.aggregateChunks += 1;
        for (const entry of batch.entries) state.symbols.add(entry.symbol);
    }
}
