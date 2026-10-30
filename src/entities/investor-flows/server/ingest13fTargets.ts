import { groupFilingsByCik } from '../lib/groupFilingsByCik';
import type { InvestorFlowsUniverse } from '../api/investorFlowsUniverseRepository';
import { processFiling } from './ingest13fFiling';
import { DeadlineSignal, SecBlockedSignal } from './ingest13fRunState';
import type { FilingTarget, Ingest13fDeps, RunState } from './ingest13fTypes';

/** 동시에 처리하는 필러 수. SEC 게이트가 속도를 정하므로 DB·네트워크 겹치기용 최소값이다. */
export const FILING_CONCURRENCY = 2;

/**
 * 제출 목록을 필러(CIK)별로 묶어 `FILING_CONCURRENCY`개 그룹씩 처리한다 — 같은 필러의 제출은 순서가 의미를 가져 직렬이다.
 * 실패한 제출은 원장에 기록하고 계속하며, 마감·SEC 차단이면 **제출 사이에서** 멈추고 끝에서 신호를 던진다
 * (`DeadlineSignal`·`SecBlockedSignal`). 원장 기록 자체가 실패하면 그 오류를 던진다.
 */
export async function processTargets(
    deps: Ingest13fDeps,
    targets: readonly FilingTarget[],
    universe: InvestorFlowsUniverse,
    floor: string,
    state: RunState
): Promise<void> {
    const groups = groupFilingsByCik(targets);

    /** 한 필러의 제출을 차례로 — 멈춤 결정(마감·차단·오류)이 서면 **제출 사이에서** 즉시 그만둔다. */
    async function runGroup(group: readonly FilingTarget[]): Promise<void> {
        for (const filing of group) {
            if (state.stop !== null) return;
            if (deps.isDeadlineReached()) {
                state.stop = 'deadline';
                return;
            }
            state.attempted.add(filing.accession);
            try {
                // 같은 필러의 제출은 순서가 의미를 가져 직렬이다.
                // react-doctor-disable-next-line react-doctor/async-await-in-loop
                await processFiling(deps, filing, universe, floor);
                state.result.filingsProcessed += 1;
            } catch (error) {
                if (error instanceof DeadlineSignal) {
                    // 마감 때문에 중단 — 실패가 아니다(원장에 기록하지 않고 다음 실행이 처음부터 다시 한다).
                    state.stop = 'deadline';
                    return;
                }
                if (deps.isSecBlockedError(error)) {
                    state.stop = 'sec_blocked';
                    return;
                }
                state.result.filingsFailed += 1;
                deps.log(
                    `[sec-13f] filing failed ${filing.accession}:`,
                    error instanceof Error ? error.message : error
                );
                try {
                    // react-doctor-disable-next-line react-doctor/async-await-in-loop
                    await deps.repo.recordFailure(
                        {
                            accession: filing.accession,
                            cik: filing.cik,
                            filingDate: filing.filingDate,
                            submissionType: filing.formType,
                        },
                        (error instanceof Error
                            ? error.message
                            : String(error)
                        ).slice(0, 500)
                    );
                } catch (recordError) {
                    state.stop = 'error';
                    throw recordError;
                }
            }
        }
    }

    for (let i = 0; i < groups.length; i += FILING_CONCURRENCY) {
        if (state.stop === null && deps.isDeadlineReached())
            state.stop = 'deadline';
        if (state.stop !== null) break;
        const wave = groups.slice(i, i + FILING_CONCURRENCY);
        // allSettled: 한 그룹이 던져도 형제가 **끝난 뒤에** 다시 던진다 — 멈춤 결정 뒤에 살아 있는 형제 작업이
        // 남아 DB·SEC를 계속 건드리지 않는다.
        // react-doctor-disable-next-line react-doctor/async-await-in-loop
        const settled = await Promise.allSettled(wave.map(runGroup));
        const rejected = settled.find(r => r.status === 'rejected');
        if (rejected?.status === 'rejected') throw rejected.reason;
    }
    if (state.stop === 'sec_blocked') throw new SecBlockedSignal();
    if (state.stop === 'deadline') throw new DeadlineSignal();
}
