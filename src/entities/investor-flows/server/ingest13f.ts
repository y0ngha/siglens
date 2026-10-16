import { streamXmlElements } from '@/shared/lib/streamXmlElements';
import {
    INVESTOR_FLOWS_13F_BACKFILL_DAYS,
    INVESTOR_FLOWS_13F_MAX_ATTEMPTS,
    INVESTOR_FLOWS_AGGREGATE_RETENTION_MONTHS,
    INVESTOR_FLOWS_BASELINE_MIN_FILERS,
    INVESTOR_FLOWS_FAILED_BACKLOG_ALERT,
    INVESTOR_FLOWS_MAINTENANCE_BUDGET_MS,
    INVESTOR_FLOWS_MAX_REAPPLY,
    INVESTOR_FLOWS_REVALIDATE_CAP,
    INVESTOR_FLOWS_STATE_BACKFILL_DONE,
    INVESTOR_FLOWS_STATE_UNIVERSE_COMPLETE,
    INVESTOR_FLOWS_UPSERT_CHUNK_SIZE,
} from '../lib/investorFlowsPolicy';
import { toUtcIsoDate } from '@/shared/lib/isoDate';
import {
    findAmendmentsToReapply,
    planPositionApplication,
    type AmendmentFiling,
} from '../lib/amendmentPlan';
import {
    addDays,
    eachDate,
    isPeriodComplete,
    isQuarterEnd,
    isWeekend,
    latestQuarterEndOnOrBefore,
    nextQuarterEnd,
    positionsRetentionFloor,
    previousQuarterEnd,
} from '../lib/investorFlowsDates';
import {
    parseSec13fPrimaryDoc,
    pickSec13fDocuments,
    type Sec13fDocumentNames,
} from '../lib/sec13fFiling';
import { parseSec13fFormIndex } from '../lib/sec13fIndex';
import { PositionAccumulator } from '../lib/sec13fPositions';
import type {
    FilingRecord,
    PositionApplyMode,
    PositionRow,
    Sec13fFilingMeta,
    Sec13fIndexEntry,
} from '../model';
import type { InvestorFlowsUniverse } from '../api/investorFlowsUniverseRepository';
import type {
    ApplyFilingInput,
    DirtyBatch,
    ReapplyAmendment,
    FilingFailureInput,
    PendingFiling,
} from '../api/investorFlows13fRepository';
import type { AggregateMode } from '../api/aggregateSql';

/**
 * 13F 증분 수집 — daily form index → 제출별 information table 스트리밍 → 유니버스 필터 → 업서트(+dirty 표시,
 * 같은 트랜잭션) → dirty 큐에서 집계 재계산 → 보존 정리 → 캐시 무효화.
 *
 * 의존(SEC·DB·시계)은 전부 주입된다 — 단위 테스트가 네트워크·DB 없이 흐름을 검증한다. 실제 의존은
 * `app/api/cron/sec-13f/createDeps.ts`가 구성한다(EN-1: I/O 구성은 app 레이어).
 *
 * ── 상태는 DB 하나다(Redis 커서 없음) ─────────────────────────────────────────────
 * 일일 커서 = `max(filing_date)`(원장) − `CURSOR_OVERLAP_DAYS`. 원장이 비어 있으면 오늘 − 200일(백필).
 * 같은 날짜 index를 다시 읽어도 accession이 이미 반영돼 있으면 건너뛰므로 겹침은 비용뿐이다.
 * 실패한 accession은 원장에 `attempts`와 함께 남아 `INVESTOR_FLOWS_13F_MAX_ATTEMPTS`번까지 재시도된다.
 *
 * ── 집계 재계산 의무는 durable하다 ─────────────────────────────────────────────────
 * 바뀐 (period, cusip)는 포지션과 **같은 트랜잭션**에서 `sec_13f_dirty_aggregates`에 기록되고, 재계산이 커밋된
 * 뒤에야 지워진다. 배포·OOM·예외로 실행이 죽어도 다음 실행이 맨 처음에 남은 dirty를 먼저 처리한다.
 *
 * ── 속도·메모리 ──────────────────────────────────────────────────────────────────
 * SEC 호출은 `secClient`의 전역 게이트가 초당 ~4.5건으로 묶는다(제출 1건 = index.json + primary_doc +
 * information table 3건 → 초당 ~1.5건). 제출 병렬도는 `FILING_CONCURRENCY`(같은 필러는 직렬).
 * information table은 청크로 흘려 파싱하고 유니버스 행만 `PositionAccumulator`에 쌓는다 — 제출당 메모리는
 * 고유 유니버스 CUSIP 수에 비례한다.
 */

/** 같은 날 index를 다시 읽는 겹침(일). 늦게 반영된 제출·직전 실행이 중단된 날을 주운다. */
export const CURSOR_OVERLAP_DAYS = 3;
/** 동시에 처리하는 필러 수. SEC 게이트가 속도를 정하므로 DB·네트워크 겹치기용 최소값이다. */
export const FILING_CONCURRENCY = 2;
/** 한 실행에서 날짜 순회와 별개로 다시 시도하는 실패 제출 수. */
export const RETRY_BATCH_SIZE = 100;
/** 2023-03-31 보고 분기부터 `value`가 달러 단위다. 이전 분기는 천 달러라 수집하지 않는다. */
export const FIRST_DOLLAR_VALUE_PERIOD = '2023-03-31';
/** 제출 원장 보존(일). 멱등 판정은 daily index 범위(200일)만 보면 되고, 실패 재시도 여유를 더한다. */
const FILING_LEDGER_RETENTION_DAYS = 800;
/** 집계 flush 한 번의 CUSIP 수(= 재계산 SQL 한 번). */
const DIRTY_FLUSH_CHUNK = INVESTOR_FLOWS_UPSERT_CHUNK_SIZE;
const STATE_POSITIONS_FLOOR = 'sec13f_positions_pruned_floor';
const STATE_DATE_PRUNE_DAY = 'sec13f_date_prunes_day';
const stateKeyPeriodMode = (period: string): string =>
    `sec13f_period_mode:${period}`;

export interface Sec13fSource {
    fetchDailyFormIndex(date: string): Promise<string | null>;
    fetchFilingIndexJson(
        cik: string,
        accession: string
    ): Promise<unknown | null>;
    fetchFilingDocumentText(
        cik: string,
        accession: string,
        fileName: string
    ): Promise<string | null>;
    fetchFilingDocumentStream(
        cik: string,
        accession: string,
        fileName: string
    ): Promise<AsyncIterable<Uint8Array> | null>;
}

export interface Ingest13fRepository {
    findFilings(
        accessions: readonly string[]
    ): Promise<Map<string, FilingRecord>>;
    latestFilingDate(): Promise<string | null>;
    listPendingRetries(
        maxAttempts: number,
        limit: number
    ): Promise<PendingFiling[]>;
    countExhaustedFailures(maxAttempts: number): Promise<number>;
    recordFailure(filing: FilingFailureInput, error: string): Promise<void>;
    findProcessedFilings(
        cik: string,
        period: string
    ): Promise<AmendmentFiling[]>;
    countProcessedFilersForPeriod(period: string): Promise<number>;
    hasPositions(cik: string, period: string): Promise<boolean>;
    applyFiling(input: ApplyFilingInput): Promise<string[]>;
    takeDirty(limit: number): Promise<DirtyBatch | null>;
    clearDirty(period: string, ids: readonly number[]): Promise<void>;
    markPeriodDirty(period: string): Promise<number>;
    recomputeAggregates(
        period: string,
        cusips: readonly string[],
        mode: AggregateMode
    ): Promise<void>;
    prunePositionsBefore(
        floor: string,
        shouldStop: () => boolean
    ): Promise<{ deleted: number; done: boolean }>;
    pruneAggregatesBefore(cutoffPeriod: string): Promise<number>;
    pruneFilingsBefore(cutoffDate: string): Promise<number>;
    getState(key: string): Promise<string | null>;
    setState(key: string, value: string): Promise<void>;
}

export interface Ingest13fDeps {
    sec: Sec13fSource;
    repo: Ingest13fRepository;
    loadUniverse: () => Promise<InvestorFlowsUniverse>;
    /** SEC가 거절(속도 제한·차단)했는지 — 배치는 그 즉시 멈춘다. */
    isSecBlockedError: (error: unknown) => boolean;
    now: () => Date;
    /** true면 새 일을 시작하지 않는다(진행 중 제출은 끝낸다). */
    isDeadlineReached: () => boolean;
    /** 집계가 바뀐 심볼의 캐시 태그 무효화(실행당 상한 `INVESTOR_FLOWS_REVALIDATE_CAP`). */
    invalidateSymbols: (symbols: readonly string[]) => void | Promise<void>;
    /**
     * 초기 백필 완료 표식이 **이번 실행에서 처음** 섰을 때 한 번 부른다 — 수급 탭의 "13F 수집 중" 안내를 담은 준비 상태
     * 캐시를 무효화한다. 생략하면 캐시 TTL(12시간)이 지나서야 안내가 사라진다.
     */
    onBackfillCompleted?: () => void | Promise<void>;
    log: (message: string, detail?: unknown) => void;
}

export type Ingest13fStop =
    | 'complete'
    | 'deadline'
    | 'sec_blocked'
    | 'empty_universe'
    /** cusip-map이 아직 전수 한 바퀴를 끝내지 않았다 — 덜 찬 유니버스로 제출을 "처리됨" 처리하지 않는다. */
    | 'universe_incomplete';

export interface Ingest13fResult {
    stoppedBy: Ingest13fStop;
    startDate: string;
    datesScanned: number;
    filingsListed: number;
    filingsProcessed: number;
    filingsAlreadyDone: number;
    filingsFailed: number;
    retried: number;
    aggregateChunks: number;
    invalidated: number;
    pruned: { positions: number; aggregates: number; filings: number };
    /** 초기 백필 완료 표식(`INVESTOR_FLOWS_STATE_BACKFILL_DONE`)이 이번 실행에서 처음 섰는가. */
    backfillCompleted: boolean;
}

type FilingTarget = Pick<
    Sec13fIndexEntry,
    'accession' | 'cik' | 'filingDate'
> & {
    formType: string;
    /** daily index의 회사명 — primary_doc에 이름이 없을 때의 대체. 재시도 대상에는 없다. */
    companyName: string | null;
};

class SecBlockedSignal extends Error {}
class DeadlineSignal extends Error {}

type RunStop = 'deadline' | 'sec_blocked' | 'error';

interface RunState {
    result: Ingest13fResult;
    attempted: Set<string>;
    /** 집계가 바뀐 심볼(무효화 대상). */
    symbols: Set<string>;
    stop: RunStop | null;
}

async function readPrimaryDoc(xml: string): Promise<Sec13fFilingMeta> {
    let meta: Sec13fFilingMeta | null = null;
    await streamXmlElements([xml], 'edgarSubmission', root => {
        meta = parseSec13fPrimaryDoc(root);
    });
    if (meta === null)
        throw new Error('primary_doc.xml has no edgarSubmission');
    return meta;
}

async function readDocuments(
    deps: Ingest13fDeps,
    cik: string,
    accession: string
): Promise<Sec13fDocumentNames> {
    return pickSec13fDocuments(
        await deps.sec.fetchFilingIndexJson(cik, accession)
    );
}

/** information table 하나를 스트리밍으로 읽어 유니버스 포지션만 모은다. */
async function readPositions(
    deps: Ingest13fDeps,
    cik: string,
    accession: string,
    infoTable: string | null,
    universe: InvestorFlowsUniverse
): Promise<PositionRow[]> {
    if (infoTable === null)
        throw new Error('information table not found in filing index');
    const stream = await deps.sec.fetchFilingDocumentStream(
        cik,
        accession,
        infoTable
    );
    if (stream === null) throw new Error('information table missing');
    const accumulator = new PositionAccumulator(universe.cusips);
    await streamXmlElements(stream, 'infoTable', element =>
        accumulator.add(element)
    );
    return accumulator.toRows();
}

const cusipIdsOf = (universe: InvestorFlowsUniverse): Map<string, number> =>
    new Map([...universe.cusips].map(([cusip, { id }]) => [cusip, id]));

/**
 * 제출 하나를 처리한다. 반영되면 dirty가 같은 트랜잭션에 남는다. 실패는 던진다 — 호출부가 원장에 기록한다.
 * 보존 범위 밖·통지·단위가 다른 옛 분기는 포지션 없이 "처리됨"만 기록한다(다시 보지 않게).
 */
async function processFiling(
    deps: Ingest13fDeps,
    filing: FilingTarget,
    universe: InvestorFlowsUniverse,
    floor: string
): Promise<void> {
    const { sec, repo } = deps;
    const docs = await readDocuments(deps, filing.cik, filing.accession);
    if (docs.primaryDoc === null)
        throw new Error('primary_doc.xml not found in filing index');
    const primaryXml = await sec.fetchFilingDocumentText(
        filing.cik,
        filing.accession,
        docs.primaryDoc
    );
    if (primaryXml === null) throw new Error('primary_doc.xml missing');
    const meta = await readPrimaryDoc(primaryXml);
    if (meta.period === null) throw new Error('periodOfReport missing');

    const cusipIds = cusipIdsOf(universe);
    const base = {
        accession: filing.accession,
        cik: filing.cik,
        filingDate: filing.filingDate,
        submissionType: filing.formType,
        amendmentType: meta.amendmentType,
        period: meta.period,
        filerName: meta.filerName ?? filing.companyName,
        cusipIds,
        universeStamp: universe.loadedAt,
        firstForPeriod: false,
    };

    const skipReason = !isQuarterEnd(meta.period)
        ? 'non-quarter-period'
        : meta.period < FIRST_DOLLAR_VALUE_PERIOD
          ? 'legacy-value-units'
          : meta.period < floor
            ? 'before-retention'
            : meta.reportType?.toUpperCase().includes('NOTICE')
              ? 'notice'
              : null;
    if (skipReason !== null) {
        await repo.applyFiling({ ...base, mode: 'skip', rows: [] });
        return;
    }

    // 정보테이블 다운로드(SEC)와 기존 원장 조회(DB)는 서로 독립이라 함께 띄운다.
    const [rows, existing] = await Promise.all([
        readPositions(
            deps,
            filing.cik,
            filing.accession,
            docs.infoTable,
            universe
        ),
        repo.findProcessedFilings(filing.cik, meta.period),
    ]);
    const incoming: AmendmentFiling = {
        accession: filing.accession,
        filingDate: filing.filingDate,
        submissionType: filing.formType,
        amendmentType: meta.amendmentType,
    };
    let mode: PositionApplyMode = planPositionApplication(incoming, existing);
    // 재수집 감지: 원장(처리된 제출)은 비었는데 포지션이 이미 있다 = `reingest-13f`가 원장을 지운 뒤다. 이때 원본 13F-HR을
    // `replace`로 반영하면 이미 병합돼 있던 NEW HOLDINGS 정정 행까지 지워져, 정정을 다시 읽을 때까지(최대 며칠) 보유 수치가
    // 일시적으로 줄어든다. 원본은 `merge`(같은 값 upsert, 새 CUSIP 행만 추가)로 반영한다. RESTATEMENT는 정의상 교체라 그대로다.
    if (
        mode === 'replace' &&
        filing.formType === '13F-HR' &&
        existing.length === 0 &&
        (await repo.hasPositions(filing.cik, meta.period))
    ) {
        mode = 'merge';
    }

    // 교체(RESTATEMENT)가 포지션을 지우므로, 이미 반영돼 있던 **나중** NEW HOLDINGS(순서가 뒤집힌 경우)를 다시 얹어야
    // 한다. 그 포지션을 **트랜잭션 전에 전부 내려받아** 두고, 교체와 재반영을 **한 트랜잭션**에서 적용한다 — 내려받다가
    // (SEC 차단·타임아웃·마감) 실패하면 교체 자체를 하지 않으므로 교체만 커밋되고 나중 정정이 영영 사라지는 일이 없다.
    const reapply: ReapplyAmendment[] = [];
    if (mode === 'replace') {
        const later = findAmendmentsToReapply(incoming, existing);
        if (later.length > INVESTOR_FLOWS_MAX_REAPPLY) {
            throw new Error(
                `too many later amendments to re-apply (${later.length})`
            );
        }
        for (const amendment of later) {
            // 마감이 지났으면 새 다운로드를 시작하지 않는다 — 이 제출은 아직 반영 전이라 다음 실행이 처음부터 다시 한다.
            if (deps.isDeadlineReached()) throw new DeadlineSignal();
            // 순서·SEC 속도 게이트상 직렬이다.
            // react-doctor-disable-next-line react-doctor/async-await-in-loop
            const amendmentDocs = await readDocuments(
                deps,
                filing.cik,
                amendment.accession
            );
            reapply.push({
                accession: amendment.accession,
                // react-doctor-disable-next-line react-doctor/async-await-in-loop
                rows: await readPositions(
                    deps,
                    filing.cik,
                    amendment.accession,
                    amendmentDocs.infoTable,
                    universe
                ),
            });
        }
    }

    await repo.applyFiling({
        ...base,
        mode,
        rows,
        reapply,
        firstForPeriod:
            mode !== 'skip' &&
            !existing.some(f => f.accession !== filing.accession),
    });
}

/** 같은 필러의 제출은 한 그룹으로 묶어 직렬(정정 규칙이 순서에 의존), 그룹끼리만 병렬. */
function groupByCik(targets: readonly FilingTarget[]): FilingTarget[][] {
    const groups = new Map<string, FilingTarget[]>();
    for (const target of targets) {
        const group = groups.get(target.cik) ?? [];
        group.push(target);
        groups.set(target.cik, group);
    }
    return [...groups.values()].map(group =>
        [...group].sort((a, b) =>
            a.filingDate !== b.filingDate
                ? a.filingDate < b.filingDate
                    ? -1
                    : 1
                : a.accession < b.accession
                  ? -1
                  : 1
        )
    );
}

async function processTargets(
    deps: Ingest13fDeps,
    targets: readonly FilingTarget[],
    universe: InvestorFlowsUniverse,
    floor: string,
    state: RunState
): Promise<void> {
    const groups = groupByCik(targets);

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

/** 보존 범위 안의 분기들(하한 ~ 가장 최근 분기말) — DB를 훑지 않고 날짜로 계산한다. */
function retainedPeriods(floor: string, today: string): string[] {
    const periods: string[] = [];
    const latest = latestQuarterEndOnOrBefore(today);
    for (
        let period = floor;
        period <= latest;
        period = nextQuarterEnd(period)
    ) {
        periods.push(period);
    }
    return periods;
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
async function reconcilePeriodModes(
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
async function flushDirty(
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

export async function run13fIngest(
    deps: Ingest13fDeps
): Promise<Ingest13fResult> {
    const now = deps.now();
    const today = toUtcIsoDate(now);
    const backfillStart = addDays(today, -INVESTOR_FLOWS_13F_BACKFILL_DAYS);
    // 배포 순서 게이트: cusip-map이 전수 한 바퀴를 끝내기 전(= 유니버스가 덜 찼을 때)에 제출을 반영하면, 나중에 매핑된
    // CUSIP은 이미 "처리됨"인 제출에서 포지션을 영영 못 얻는다. 표식은 durable하고 한 번 서면 풀리지 않는다.
    if (
        (await deps.repo.getState(INVESTOR_FLOWS_STATE_UNIVERSE_COMPLETE)) ===
        null
    ) {
        deps.log(
            '[sec-13f] universe_incomplete — cusip-map has not finished a full pass yet; nothing ingested'
        );
        return {
            stoppedBy: 'universe_incomplete',
            startDate: backfillStart,
            datesScanned: 0,
            filingsListed: 0,
            filingsProcessed: 0,
            filingsAlreadyDone: 0,
            filingsFailed: 0,
            retried: 0,
            aggregateChunks: 0,
            invalidated: 0,
            pruned: { positions: 0, aggregates: 0, filings: 0 },
            backfillCompleted: false,
        };
    }
    const last = await deps.repo.latestFilingDate();
    const startDate =
        last === null
            ? backfillStart
            : ([backfillStart, addDays(last, -CURSOR_OVERLAP_DAYS)]
                  .sort()
                  .at(-1) as string);
    const floor = positionsRetentionFloor(today);

    const state: RunState = {
        attempted: new Set(),
        symbols: new Set(),
        stop: null,
        result: {
            stoppedBy: 'complete',
            startDate,
            datesScanned: 0,
            filingsListed: 0,
            filingsProcessed: 0,
            filingsAlreadyDone: 0,
            filingsFailed: 0,
            retried: 0,
            aggregateChunks: 0,
            invalidated: 0,
            pruned: { positions: 0, aggregates: 0, filings: 0 },
            backfillCompleted: false,
        },
    };

    const universe = await deps.loadUniverse();
    if (universe.cusips.size === 0) {
        deps.log('[sec-13f] empty universe — run cusip-map first');
        state.result.stoppedBy = 'empty_universe';
        return state.result;
    }

    // 유지보수(집계 flush·정리)는 마감과 별개의 시간 상자 안에서 한다 — 남은 일은 durable이라 다음 실행이 잇는다.
    const maintenanceStop = (startedAt: number) => (): boolean =>
        Date.now() - startedAt > INVESTOR_FLOWS_MAINTENANCE_BUDGET_MS;
    const flush = (): Promise<void> =>
        flushDirty(deps, state, floor, today, maintenanceStop(Date.now()));

    try {
        // 분기 모드가 바뀌었다면(진행 중 → 완결 등) 그 분기를 다시 계산 대상으로 올린 뒤, 이전 실행이 flush 전에
        // 죽어 남긴 dirty까지 먼저 처리한다.
        await reconcilePeriodModes(deps, floor, today);
        await flushDirty(deps, state, floor, today, () =>
            deps.isDeadlineReached()
        );

        for (const date of eachDate(startDate, today)) {
            if (isWeekend(date)) continue;
            if (deps.isDeadlineReached()) throw new DeadlineSignal();
            let text: string | null;
            try {
                text = await deps.sec.fetchDailyFormIndex(date);
            } catch (error) {
                if (deps.isSecBlockedError(error)) throw new SecBlockedSignal();
                throw error;
            }
            state.result.datesScanned += 1;
            if (text === null) continue;
            const entries = parseSec13fFormIndex(text);
            state.result.filingsListed += entries.length;
            const known = await deps.repo.findFilings(
                entries.map(e => e.accession)
            );
            const targets: FilingTarget[] = [];
            for (const entry of entries) {
                const record = known.get(entry.accession);
                if (
                    record !== undefined &&
                    (record.processedAt !== null ||
                        record.attempts >= INVESTOR_FLOWS_13F_MAX_ATTEMPTS)
                ) {
                    state.result.filingsAlreadyDone += 1;
                    continue;
                }
                targets.push(entry);
            }
            try {
                await processTargets(deps, targets, universe, floor, state);
            } finally {
                // 날짜 단위로 집계를 확정한다. 이 flush가 못 끝나도 dirty가 남아 있다. 필러 수가 임계를 넘어
                // baseline 판정이 바뀌었을 수 있어 flush 전에 모드를 다시 본다.
                await reconcilePeriodModes(deps, floor, today);
                await flush();
            }
        }

        // 날짜 범위 밖(커서보다 오래된 날짜)에 남은 실패 제출을 다시 시도한다.
        const pending = (
            await deps.repo.listPendingRetries(
                INVESTOR_FLOWS_13F_MAX_ATTEMPTS,
                RETRY_BATCH_SIZE
            )
        ).filter(p => !state.attempted.has(p.accession));
        state.result.retried = pending.length;
        try {
            await processTargets(
                deps,
                pending.map(p => ({
                    accession: p.accession,
                    cik: p.cik,
                    filingDate: p.filingDate,
                    formType: p.submissionType,
                    companyName: null,
                })),
                universe,
                floor,
                state
            );
        } finally {
            await reconcilePeriodModes(deps, floor, today);
            await flush();
        }
    } catch (error) {
        if (error instanceof DeadlineSignal)
            state.result.stoppedBy = 'deadline';
        else if (error instanceof SecBlockedSignal) {
            state.result.stoppedBy = 'sec_blocked';
            // 메트릭 필터 접두(`[sec-13f] sec_blocked`) — 반복되면 알람(infra/aws/18-*).
            deps.log(
                '[sec-13f] sec_blocked — SEC refused the request, stopping'
            );
        } else throw error;
    }

    if (state.result.stoppedBy !== 'sec_blocked') {
        state.result.pruned = await pruneRetention(
            deps,
            today,
            maintenanceStop(Date.now())
        );
        const exhausted = await deps.repo.countExhaustedFailures(
            INVESTOR_FLOWS_13F_MAX_ATTEMPTS
        );
        if (exhausted >= INVESTOR_FLOWS_FAILED_BACKLOG_ALERT) {
            deps.log(
                `[sec-13f] backlog of permanently failed accessions: ${exhausted}`
            );
        }
    }

    const toInvalidate = [...state.symbols].slice(
        0,
        INVESTOR_FLOWS_REVALIDATE_CAP
    );
    if (toInvalidate.length > 0) {
        await deps.invalidateSymbols(toInvalidate);
        state.result.invalidated = toInvalidate.length;
    }
    // 표식은 이번 실행이 **깔끔하게** 끝났을 때만 선다: 무효화 상한(500)에 잘려 낡은 심볼 캐시가 남지 않았고(`state.symbols`가
    // 상한 이하), dirty 큐가 비었다(집계가 모두 반영됨). 아니면 다음 실행이 다시 판정한다 — 표식이 서는 순간 "수집 중" 안내가
    // 걷히고 빈 구간은 "데이터 없음"이 되므로, 아직 안 채워진 종목이 있는 채로 서면 안 된다.
    if (
        state.result.stoppedBy === 'complete' &&
        state.symbols.size <= INVESTOR_FLOWS_REVALIDATE_CAP
    ) {
        state.result.backfillCompleted = await markBackfillDone(deps);
        if (state.result.backfillCompleted) await deps.onBackfillCompleted?.();
    }
    return state.result;
}

/**
 * 초기 백필 완료 표식을 세운다(set-once, 다시 지우지 않는다). 날짜 순회가 마감·차단 없이 **오늘까지** 끝났고(`complete`)
 * 원장에 처리된 제출이 하나라도 있을 때만 선다 — SEC가 계속 빈 응답을 주는 환경에서 아무것도 모으지 못하고 "완료"가
 * 되는 것을 막는다. dirty 큐가 비어 있어야 한다(`takeDirty` null). 커서가 항상 앞으로만 가므로(`max(filing_date)` − 겹침) 한 번 오늘에 닿은 실행은 백필 창 전체를
 * 지난 것이다. 새로 세웠으면 `true`.
 */
async function markBackfillDone(deps: Ingest13fDeps): Promise<boolean> {
    const { repo } = deps;
    if ((await repo.getState(INVESTOR_FLOWS_STATE_BACKFILL_DONE)) !== null)
        return false;
    if ((await repo.latestFilingDate()) === null) return false;
    // dirty 큐가 남아 있으면 일부 종목의 집계가 아직 반영 전이다. `takeDirty`는 실제 dirty 행을 점유하거나 지우지 않지만 순수한
    // 읽기는 아니다 — cusip_symbol_map에 없는 id만 남은 고아 dirty 행은 정리(삭제)한다. 읽기 전용 트랜잭션으로 감싸지 말 것.
    if ((await repo.takeDirty(1)) !== null) return false;
    await repo.setState(INVESTOR_FLOWS_STATE_BACKFILL_DONE, 'done');
    deps.log('[sec-13f] initial backfill complete');
    return true;
}

/**
 * 보존 정책(설계 §2): 포지션은 하한 이전 삭제(**하한이 움직였을 때만**, 배치로), 집계 36개월·원장 800일은
 * 하루에 한 번. 마지막으로 정리한 값은 `investor_flows_state`에 둔다 — 정리가 시간 상자에 걸려 못 끝났으면 기록하지
 * 않아 다음 실행이 이어 간다.
 */
async function pruneRetention(
    deps: Ingest13fDeps,
    today: string,
    shouldStop: () => boolean
): Promise<Ingest13fResult['pruned']> {
    const { repo } = deps;
    const pruned = { positions: 0, aggregates: 0, filings: 0 };
    const floor = positionsRetentionFloor(today);
    const lastFloor = await repo.getState(STATE_POSITIONS_FLOOR);
    if (lastFloor === null || lastFloor < floor) {
        const result = await repo.prunePositionsBefore(floor, shouldStop);
        pruned.positions = result.deleted;
        if (result.done) await repo.setState(STATE_POSITIONS_FLOOR, floor);
    }
    if ((await repo.getState(STATE_DATE_PRUNE_DAY)) !== today) {
        const aggregateCutoff = latestQuarterEndOnOrBefore(
            addDays(
                today,
                -Math.round(INVESTOR_FLOWS_AGGREGATE_RETENTION_MONTHS * 30.5)
            )
        );
        pruned.aggregates = await repo.pruneAggregatesBefore(aggregateCutoff);
        pruned.filings = await repo.pruneFilingsBefore(
            addDays(today, -FILING_LEDGER_RETENTION_DAYS)
        );
        await repo.setState(STATE_DATE_PRUNE_DAY, today);
    }
    return pruned;
}
