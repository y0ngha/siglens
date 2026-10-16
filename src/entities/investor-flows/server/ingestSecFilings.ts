import { toUtcIsoDate } from '@/shared/lib/isoDate';
import { addDays, eachDate, isWeekend } from '../lib/investorFlowsDates';
import { deriveFilingsStatus } from '../lib/investorFlowsReadiness';
import {
    INVESTOR_FLOWS_FORM144_RETENTION_DAYS,
    INVESTOR_FLOWS_OFFERING_RETENTION_DAYS,
    INVESTOR_FLOWS_REVALIDATE_CAP,
    INVESTOR_FLOWS_SEC_FILINGS_BACKFILL_DAYS,
    INVESTOR_FLOWS_SEC_FILINGS_MAX_ATTEMPTS,
    INVESTOR_FLOWS_STATE_SEC_FILINGS_CURSOR,
    INVESTOR_FLOWS_STATE_UNIVERSE_COMPLETE,
    INVESTOR_FLOWS_FAILED_BACKLOG_ALERT,
} from '../lib/investorFlowsPolicy';
import { parseForm144Xml } from '../lib/form144Parser';
import { classify424B5 } from '../lib/offeringClassifier';
import {
    FORM_144_FORMS,
    OFFERING_FORMS,
    OFFERING_FORM_NEEDS_DOCUMENT,
    offeringKindForForm,
    secFilingIndexUrl,
    selectIndexTargets,
    type IndexTarget,
} from '../lib/offeringIndex';
import { parseSecFormIndex } from '../lib/secFormIndex';
import type {
    FilingRetry,
    Form144Row,
    OfferingFilingRow,
    OfferingKind,
} from '../model';
import type {
    FilingFailureTarget,
    FilingsPruneCutoffs,
    FilingsPruneResult,
} from '../api/investorFlowsFilingsRepository';

/**
 * Form 144(매도 예정 신고)·증자/희석 공시 증분 수집 — `sec-13f` cron 실행 **안에서** 13F 다음에 남은 시간으로 돈다
 * (`runSecIndexIngest`). 같은 daily form index(`form.YYYYMMDD.idx`)를 읽고 같은 SEC 게이트·공유 락 아래라 cron 합계 SEC 속도가
 * 늘지 않는다(`shared/config/investorFlows.ts`의 불변식).
 *
 * ── 커서는 13F와 따로다 ─────────────────────────────────────────────────────────────────────────────
 * `investor_flows_state.sec_filings_cursor` = 끝까지 처리한 마지막 날짜. 다음 실행은 `커서 − CURSOR_OVERLAP_DAYS`부터(비어
 * 있으면 오늘 − 180일) 오늘까지 평일 index를 읽는다. 13F 백필과 독립이라 어느 쪽이 먼저 끝나도 된다.
 *
 * ── 문서 요청은 유니버스 발행사에만 ──────────────────────────────────────────────────────────────────
 * index 줄의 CIK가 `sec_cik_symbol_map`에 있는 accession만 대상이다(`selectIndexTargets`). Form 144는 `primary_doc.xml`(≈5KB) 하나,
 * `424B5`는 제출 `.txt`의 앞 256KB만(판매 방식 분류), 그 밖의 증자 양식은 **문서 없이** 양식으로 종류가 정해진다.
 * 이미 저장된 accession·시도를 소진한 실패·음성 표식(읽었지만 유니버스 밖 발행사라 저장하지 않은 Form 144)은 다시 받지 않는다.
 * 문서 실패는 `sec_filings_failures`에 남아 최대 3번 재시도된다.
 *
 * 의존(SEC·DB·시계)은 전부 주입된다(EN-1: I/O 구성은 `app/api/cron/sec-13f/createDeps.ts`).
 */

/** 같은 날 index를 다시 읽는 겹침(일) — 늦게 반영된 제출·직전 실행이 중단된 날을 주운다. */
export const SEC_FILINGS_CURSOR_OVERLAP_DAYS = 3;
/** 동시에 받는 문서 수. SEC 게이트가 속도를 정하므로 네트워크·DB 겹치기용 최소값이다. */
export const SEC_FILINGS_DOCUMENT_CONCURRENCY = 2;
/** 한 실행에서 날짜 순회와 별개로 다시 시도하는 실패 문서 수. */
export const SEC_FILINGS_RETRY_BATCH_SIZE = 50;
const FORM_144_DOCUMENT = 'primary_doc.xml';
const STATE_PRUNE_DAY = 'sec_filings_prune_day';
const INDEX_FORMS: ReadonlySet<string> = new Set([
    ...FORM_144_FORMS,
    ...OFFERING_FORMS,
]);

export interface SecFilingsSource {
    fetchDailyFormIndex(date: string): Promise<string | null>;
    fetchFilingDocumentText(
        cik: string,
        accession: string,
        fileName: string
    ): Promise<string | null>;
    fetchFilingDocumentHead(
        cik: string,
        accession: string,
        fileName: string
    ): Promise<string | null>;
}

export interface IngestSecFilingsRepository {
    getState(key: string): Promise<string | null>;
    setState(key: string, value: string): Promise<void>;
    loadCikSymbols(): Promise<Map<number, string[]>>;
    findStoredForm144(accessions: readonly string[]): Promise<Set<string>>;
    findStoredOfferings(accessions: readonly string[]): Promise<Set<string>>;
    findFailureAttempts(
        accessions: readonly string[]
    ): Promise<Map<string, number>>;
    upsertForm144(rows: readonly Form144Row[]): Promise<void>;
    upsertOfferings(rows: readonly OfferingFilingRow[]): Promise<void>;
    recordFailure(target: FilingFailureTarget, error: string): Promise<void>;
    recordSkipped(
        target: FilingFailureTarget,
        reason: string,
        maxAttempts: number
    ): Promise<void>;
    listRetries(maxAttempts: number, limit: number): Promise<FilingRetry[]>;
    countExhaustedFailures(maxAttempts: number): Promise<number>;
    pruneBefore(cutoffs: FilingsPruneCutoffs): Promise<FilingsPruneResult>;
}

export interface IngestSecFilingsDeps {
    sec: SecFilingsSource;
    repo: IngestSecFilingsRepository;
    /** SEC가 거절(속도 제한·차단)했는지 — 그 즉시 이 실행의 SEC 요청을 전부 멈춘다. */
    isSecBlockedError: (error: unknown) => boolean;
    now: () => Date;
    /** true면 새 날짜·새 문서를 시작하지 않는다(진행 중 문서는 끝낸다). */
    isDeadlineReached: () => boolean;
    /** 새 공시가 저장된 심볼의 캐시 태그 무효화(실행당 상한 `INVESTOR_FLOWS_REVALIDATE_CAP`). */
    invalidateSymbols: (symbols: readonly string[]) => void | Promise<void>;
    /**
     * 공시 커서가 이번 실행에서 "따라잡음"(오늘에서 `INVESTOR_FLOWS_SEC_FILINGS_READY_LAG_DAYS`일 안, `deriveFilingsStatus`)으로
     * **넘어갔을 때** 한 번 부른다 — 수급 탭의 Form 144·증자 공시 "수집 중" 안내를 담은 준비 상태 캐시를 무효화한다(`runFinraIngest`의
     * `onFirstDataStored`와 같은 역할). 실행 전에 이미 따라잡은 상태였으면 부르지 않는다.
     */
    onCaughtUp?: () => void | Promise<void>;
    log: (message: string, detail?: unknown) => void;
}

export type IngestSecFilingsStop =
    | 'complete'
    | 'deadline'
    | 'sec_blocked'
    | 'universe_incomplete'
    /** `sec_cik_symbol_map`이 비었다 — cusip-map cron이 `company_tickers.json`을 아직 받지 않았다. 커서를 움직이지 않는다. */
    | 'cik_map_empty';

export interface IngestSecFilingsResult {
    stoppedBy: IngestSecFilingsStop;
    startDate: string;
    datesScanned: number;
    /** 이번 실행이 끝까지 처리한 마지막 날짜(커서). */
    cursor: string | null;
    form144Stored: number;
    offeringsStored: number;
    documentsFetched: number;
    documentsFailed: number;
    /** 읽었지만 일부러 저장하지 않아 음성 표식을 남긴 문서(유니버스 밖 발행사의 Form 144). */
    documentsSkipped: number;
    retried: number;
    invalidated: number;
    pruned: FilingsPruneResult;
    /** 이번 실행으로 커서가 처음 "따라잡음"이 됐는가(= 준비 상태 `collecting` → `ready`). */
    caughtUp: boolean;
}

class SecBlockedSignal extends Error {}
class DeadlineSignal extends Error {}

interface RunState {
    result: IngestSecFilingsResult;
    symbols: Set<string>;
    attempted: Set<string>;
}

/** 문서 하나를 받는 일 — 성공하면 저장할 행을, 실패하면 던진다. */
interface DocumentJob {
    target: FilingFailureTarget;
    run: () => Promise<{
        form144?: Form144Row;
        offerings?: OfferingFilingRow[];
        /** 읽었지만 저장하지 않은 이유 — 음성 표식으로 남겨 다시 받지 않는다. */
        skipped?: string;
    }>;
}

const emptyPruned = (): FilingsPruneResult => ({
    form144: 0,
    offerings: 0,
    failures: 0,
});

/** 발행사 CIK의 대표 심볼(정렬 첫째) — Form 144 행의 `symbol`. 읽을 때는 CIK로 찾아 모든 클래스가 본다. */
const representativeSymbol = (symbols: readonly string[]): string | undefined =>
    [...symbols].toSorted()[0];

function form144Job(
    deps: IngestSecFilingsDeps,
    target: FilingFailureTarget,
    cikSymbols: ReadonlyMap<number, readonly string[]>
): DocumentJob {
    return {
        target,
        run: async () => {
            const xml = await deps.sec.fetchFilingDocumentText(
                target.cik,
                target.accession,
                FORM_144_DOCUMENT
            );
            if (xml === null) throw new Error('primary_doc.xml missing');
            const doc = await parseForm144Xml(xml);
            if (doc === null) throw new Error('Form 144 document unparseable');
            const issuerCik = Number(doc.issuerCik);
            const symbol = representativeSymbol(
                cikSymbols.get(issuerCik) ?? []
            );
            // index 줄에서 맞은 CIK가 발행사가 아니라 보고자(상장사가 다른 회사 주식을 파는 경우)였다 — 유니버스 발행사 신고가 아니다.
            // 다음 실행의 겹침 구간이 같은 문서를 또 받지 않도록 음성 표식을 남긴다(`recordSkipped`).
            if (symbol === undefined) {
                return {
                    skipped: `issuer CIK ${issuerCik} is outside the universe`,
                };
            }
            const { issuerCik: _cik, issuerName: _name, ...sale } = doc;
            return {
                form144: {
                    ...sale,
                    accession: target.accession,
                    issuerCik,
                    symbol,
                    formType: target.formType,
                    filingDate: target.filingDate,
                },
            };
        },
    };
}

function offeringRows(
    accession: string,
    formType: string,
    filingDate: string,
    issuers: ReadonlyMap<string, readonly string[]>,
    kind: OfferingKind
): OfferingFilingRow[] {
    return [...issuers].flatMap(([cik, symbols]) =>
        symbols.map(symbol => ({
            accession,
            symbol,
            issuerCik: Number(cik),
            formType,
            filingDate,
            kind,
            url: secFilingIndexUrl(cik, accession),
        }))
    );
}

function prospectusJob(
    deps: IngestSecFilingsDeps,
    target: FilingFailureTarget,
    issuers: ReadonlyMap<string, readonly string[]>
): DocumentJob {
    return {
        target,
        run: async () => {
            // 제출 `.txt`의 첫 문서가 본 문서다 — 이름을 찾는 index.json 요청 없이 머리만 받는다.
            const head = await deps.sec.fetchFilingDocumentHead(
                target.cik,
                target.accession,
                `${target.accession}.txt`
            );
            if (head === null) throw new Error('424B5 submission missing');
            return {
                offerings: offeringRows(
                    target.accession,
                    target.formType,
                    target.filingDate,
                    issuers,
                    classify424B5(head)
                ),
            };
        },
    };
}

/** 문서 작업을 `SEC_FILINGS_DOCUMENT_CONCURRENCY`씩 돌린다. 마감·차단이면 새 작업을 시작하지 않고 신호를 던진다. */
async function runDocumentJobs(
    deps: IngestSecFilingsDeps,
    jobs: readonly DocumentJob[],
    state: RunState
): Promise<{ form144: Form144Row[]; offerings: OfferingFilingRow[] }> {
    const form144: Form144Row[] = [];
    const offerings: OfferingFilingRow[] = [];
    let stop: 'deadline' | 'sec_blocked' | null = null;
    for (let i = 0; i < jobs.length; i += SEC_FILINGS_DOCUMENT_CONCURRENCY) {
        if (stop === null && deps.isDeadlineReached()) stop = 'deadline';
        if (stop !== null) break;
        const wave = jobs.slice(i, i + SEC_FILINGS_DOCUMENT_CONCURRENCY);
        // 한 묶음은 함께 띄우고 묶음끼리는 직렬이다(SEC 게이트가 속도를 정한다).
        // 작업마다 결과를 잡아 둔다(거부도 값으로) — 결과와 작업의 짝을 인덱스로 다시 맞추지 않는다.
        // react-doctor-disable-next-line react-doctor/async-await-in-loop
        const settled = await Promise.all(
            wave.map(async job => {
                state.attempted.add(job.target.accession);
                state.result.documentsFetched += 1;
                try {
                    return {
                        job,
                        outcome: {
                            status: 'fulfilled' as const,
                            value: await job.run(),
                        },
                    };
                } catch (reason) {
                    return {
                        job,
                        outcome: { status: 'rejected' as const, reason },
                    };
                }
            })
        );
        for (const { job, outcome } of settled) {
            if (outcome.status === 'fulfilled') {
                if (outcome.value.form144 !== undefined)
                    form144.push(outcome.value.form144);
                offerings.push(...(outcome.value.offerings ?? []));
                if (outcome.value.skipped !== undefined) {
                    state.result.documentsSkipped += 1;
                    // react-doctor-disable-next-line react-doctor/async-await-in-loop
                    await deps.repo.recordSkipped(
                        job.target,
                        outcome.value.skipped,
                        INVESTOR_FLOWS_SEC_FILINGS_MAX_ATTEMPTS
                    );
                }
                continue;
            }
            if (deps.isSecBlockedError(outcome.reason)) {
                stop = 'sec_blocked';
                continue;
            }
            state.result.documentsFailed += 1;
            const message = (
                outcome.reason instanceof Error
                    ? outcome.reason.message
                    : String(outcome.reason)
            ).slice(0, 500);
            deps.log(
                `[sec-filings] document failed ${job.target.accession}:`,
                message
            );
            // 실패 기록은 순서가 상관없지만 DB를 한 번에 두드리지 않게 직렬로 쓴다.
            // react-doctor-disable-next-line react-doctor/async-await-in-loop
            await deps.repo.recordFailure(job.target, message);
        }
    }
    // 받은 것은 멈추더라도 저장한다 — 다음 실행이 같은 문서를 다시 받지 않게.
    await persist(deps, state, form144, offerings);
    if (stop === 'sec_blocked') throw new SecBlockedSignal();
    if (stop === 'deadline') throw new DeadlineSignal();
    return { form144, offerings };
}

async function persist(
    deps: IngestSecFilingsDeps,
    state: RunState,
    form144: readonly Form144Row[],
    offerings: readonly OfferingFilingRow[]
): Promise<void> {
    await deps.repo.upsertForm144(form144);
    await deps.repo.upsertOfferings(offerings);
    state.result.form144Stored += form144.length;
    state.result.offeringsStored += offerings.length;
    for (const row of form144) state.symbols.add(row.symbol);
    for (const row of offerings) state.symbols.add(row.symbol);
}

const failureTarget = (target: IndexTarget): FilingFailureTarget => ({
    accession: target.accession,
    // 문서를 받을 폴더 — 유니버스 발행사 CIK 중 첫째(같은 accession은 어느 등록인 폴더로도 열린다).
    cik: target.primaryCik,
    formType: target.formType,
    filingDate: target.filingDate,
});

/** 하루치 index를 처리한다 — 문서 없는 증자 공시는 바로 저장하고, 문서가 필요한 것(Form 144·424B5)만 받는다. */
async function processDay(
    deps: IngestSecFilingsDeps,
    text: string,
    cikSymbols: ReadonlyMap<number, readonly string[]>,
    state: RunState
): Promise<void> {
    const targets = selectIndexTargets(
        parseSecFormIndex(text, INDEX_FORMS),
        cikSymbols
    );
    if (targets.length === 0) return;
    const accessions = targets.map(t => t.accession);
    const [storedForm144, storedOfferings, failures] = await Promise.all([
        deps.repo.findStoredForm144(accessions),
        deps.repo.findStoredOfferings(accessions),
        deps.repo.findFailureAttempts(accessions),
    ]);
    const exhausted = (accession: string): boolean =>
        (failures.get(accession) ?? 0) >=
        INVESTOR_FLOWS_SEC_FILINGS_MAX_ATTEMPTS;

    const formOnly: OfferingFilingRow[] = [];
    const jobs: DocumentJob[] = [];
    for (const target of targets) {
        if (FORM_144_FORMS.has(target.formType)) {
            if (
                storedForm144.has(target.accession) ||
                exhausted(target.accession)
            )
                continue;
            jobs.push(form144Job(deps, failureTarget(target), cikSymbols));
            continue;
        }
        if (storedOfferings.has(target.accession)) continue;
        const kind = offeringKindForForm(target.formType);
        if (kind === undefined) continue;
        if (kind === null) {
            if (exhausted(target.accession)) continue;
            jobs.push(
                prospectusJob(deps, failureTarget(target), target.issuers)
            );
            continue;
        }
        formOnly.push(
            ...offeringRows(
                target.accession,
                target.formType,
                target.filingDate,
                target.issuers,
                kind
            )
        );
    }
    await persist(deps, state, [], formOnly);
    await runDocumentJobs(deps, jobs, state);
}

/** 날짜 순회 밖에 남은 실패 문서를 다시 시도한다. */
async function processRetries(
    deps: IngestSecFilingsDeps,
    cikSymbols: ReadonlyMap<number, readonly string[]>,
    state: RunState
): Promise<void> {
    const pending = (
        await deps.repo.listRetries(
            INVESTOR_FLOWS_SEC_FILINGS_MAX_ATTEMPTS,
            SEC_FILINGS_RETRY_BATCH_SIZE
        )
    ).filter(retry => !state.attempted.has(retry.accession));
    state.result.retried = pending.length;
    const jobs = pending.flatMap(({ attempts: _attempts, ...target }) => {
        if (FORM_144_FORMS.has(target.formType)) {
            return [form144Job(deps, target, cikSymbols)];
        }
        const symbols = cikSymbols.get(Number(target.cik));
        // 그새 유니버스에서 빠진 발행사 — 받을 이유가 없다(실패 기록은 보존 정리가 지운다).
        if (
            target.formType !== OFFERING_FORM_NEEDS_DOCUMENT ||
            symbols === undefined
        )
            return [];
        return [prospectusJob(deps, target, new Map([[target.cik, symbols]]))];
    });
    await runDocumentJobs(deps, jobs, state);
}

export async function runSecFilingsIngest(
    deps: IngestSecFilingsDeps
): Promise<IngestSecFilingsResult> {
    const today = toUtcIsoDate(deps.now());
    const backfillStart = addDays(
        today,
        -INVESTOR_FLOWS_SEC_FILINGS_BACKFILL_DAYS
    );
    const cursor = await deps.repo.getState(
        INVESTOR_FLOWS_STATE_SEC_FILINGS_CURSOR
    );
    const overlapStart =
        cursor === null
            ? backfillStart
            : addDays(cursor, -SEC_FILINGS_CURSOR_OVERLAP_DAYS);
    // ISO 날짜는 문자열 비교가 날짜 비교다 — 백필 창보다 이른 날로는 거슬러 가지 않는다.
    const startDate =
        overlapStart > backfillStart ? overlapStart : backfillStart;
    const state: RunState = {
        symbols: new Set(),
        attempted: new Set(),
        result: {
            stoppedBy: 'complete',
            startDate,
            datesScanned: 0,
            cursor,
            form144Stored: 0,
            offeringsStored: 0,
            documentsFetched: 0,
            documentsFailed: 0,
            documentsSkipped: 0,
            retried: 0,
            invalidated: 0,
            pruned: emptyPruned(),
            caughtUp: false,
        },
    };

    // 13F와 같은 배포 순서 게이트(유니버스가 덜 찬 채로 수집하지 않는다).
    if (
        (await deps.repo.getState(INVESTOR_FLOWS_STATE_UNIVERSE_COMPLETE)) ===
        null
    ) {
        state.result.stoppedBy = 'universe_incomplete';
        return state.result;
    }
    const cikSymbols = await deps.repo.loadCikSymbols();
    if (cikSymbols.size === 0) {
        deps.log(
            '[sec-filings] cik_map_empty — sec_cik_symbol_map is empty (cusip-map syncs company_tickers.json weekly); nothing ingested'
        );
        state.result.stoppedBy = 'cik_map_empty';
        return state.result;
    }

    try {
        for (const date of eachDate(startDate, today)) {
            if (isWeekend(date)) continue;
            if (deps.isDeadlineReached()) throw new DeadlineSignal();
            let text: string | null;
            try {
                // 날짜는 순서대로 하나씩 — 커서가 앞으로만 간다.
                // react-doctor-disable-next-line react-doctor/async-await-in-loop
                text = await deps.sec.fetchDailyFormIndex(date);
            } catch (error) {
                if (deps.isSecBlockedError(error)) throw new SecBlockedSignal();
                throw error;
            }
            state.result.datesScanned += 1;
            // 없는 날(휴일·아직 미공개)은 커서를 움직이지 않는다 — 다음 실행이 겹침 구간에서 다시 본다.
            if (text === null) continue;
            // react-doctor-disable-next-line react-doctor/async-await-in-loop
            await processDay(deps, text, cikSymbols, state);
            // react-doctor-disable-next-line react-doctor/async-await-in-loop
            await deps.repo.setState(
                INVESTOR_FLOWS_STATE_SEC_FILINGS_CURSOR,
                date
            );
            state.result.cursor = date;
        }
        await processRetries(deps, cikSymbols, state);
    } catch (error) {
        if (error instanceof DeadlineSignal)
            state.result.stoppedBy = 'deadline';
        else if (error instanceof SecBlockedSignal) {
            state.result.stoppedBy = 'sec_blocked';
            // 메트릭 필터 접두(`[sec-filings] sec_blocked`, infra/aws/19-*).
            deps.log(
                '[sec-filings] sec_blocked — SEC refused the request, stopping'
            );
        } else throw error;
    }

    if (state.result.stoppedBy !== 'sec_blocked') {
        state.result.pruned = await pruneDaily(deps, today);
        const exhausted = await deps.repo.countExhaustedFailures(
            INVESTOR_FLOWS_SEC_FILINGS_MAX_ATTEMPTS
        );
        if (exhausted >= INVESTOR_FLOWS_FAILED_BACKLOG_ALERT) {
            deps.log(
                `[sec-filings] backlog of permanently failed documents: ${exhausted}`
            );
        }
    }
    const toInvalidate = [...state.symbols]
        .toSorted()
        .slice(0, INVESTOR_FLOWS_REVALIDATE_CAP);
    if (toInvalidate.length > 0) {
        await deps.invalidateSymbols(toInvalidate);
        state.result.invalidated = toInvalidate.length;
    }
    state.result.caughtUp =
        deriveFilingsStatus(cursor, today) === 'collecting' &&
        deriveFilingsStatus(state.result.cursor, today) === 'ready';
    if (state.result.caughtUp) await deps.onCaughtUp?.();
    return state.result;
}

/** 보존 정리는 하루 한 번(`sec_filings_prune_day`). */
async function pruneDaily(
    deps: IngestSecFilingsDeps,
    today: string
): Promise<FilingsPruneResult> {
    if ((await deps.repo.getState(STATE_PRUNE_DAY)) === today)
        return emptyPruned();
    const form144Before = addDays(
        today,
        -INVESTOR_FLOWS_FORM144_RETENTION_DAYS
    );
    const pruned = await deps.repo.pruneBefore({
        form144Before,
        offeringsBefore: addDays(
            today,
            -INVESTOR_FLOWS_OFFERING_RETENTION_DAYS
        ),
        failuresBefore: form144Before,
    });
    await deps.repo.setState(STATE_PRUNE_DAY, today);
    return pruned;
}
