import { INVESTOR_FLOWS_SEC_FILINGS_MAX_ATTEMPTS } from '../lib/investorFlowsPolicy';
import { parseForm144Xml } from '../lib/form144Parser';
import { classify424B5 } from '../lib/offeringClassifier';
import {
    FORM_144_DOCUMENT,
    offeringRows,
    representativeSymbol,
    type DocumentPlan,
} from '../lib/secFilingsPlan';
import type { Form144Row, OfferingFilingRow } from '../model';
import type { FilingFailureTarget } from '../api/investorFlowsFilingsRepository';
import type { IngestSecFilingsDeps, RunState } from './ingestSecFilingsTypes';

/** 동시에 받는 문서 수. SEC 게이트가 속도를 정하므로 네트워크·DB 겹치기용 최소값이다. */
export const SEC_FILINGS_DOCUMENT_CONCURRENCY = 2;

/** 이 실행의 SEC 요청을 전부 멈추라는 신호 — 차단된 오류를 감싸 루프 밖으로 올린다. */
export class SecBlockedSignal extends Error {}
/** 마감 때문에 중단하라는 신호 — 실패가 아니라 실패 기록을 남기지 않는다. */
export class DeadlineSignal extends Error {}

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

/** 문서 계획을 실제로 받는 작업으로 바꾼다. */
function toJob(
    deps: IngestSecFilingsDeps,
    plan: DocumentPlan,
    cikSymbols: ReadonlyMap<number, readonly string[]>
): DocumentJob {
    return plan.kind === 'form144'
        ? form144Job(deps, plan.target, cikSymbols)
        : prospectusJob(deps, plan.target, plan.issuers);
}

/**
 * 받은 행을 저장하고 결과 수·무효화 대상 심볼을 갱신한다. 문서 없는 증자 공시(`[]`, `formOnly`)와 문서 작업의 결과가 함께 쓴다.
 */
export async function persist(
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

/**
 * 문서 계획을 `SEC_FILINGS_DOCUMENT_CONCURRENCY`씩 돌린다. 마감·차단이면 새 작업을 시작하지 않고, 받은 것은 저장한 뒤
 * 신호(`DeadlineSignal`·`SecBlockedSignal`)를 던진다. 실패는 원장(`sec_filings_failures`)에 기록하고 계속한다.
 */
export async function runDocumentJobs(
    deps: IngestSecFilingsDeps,
    plans: readonly DocumentPlan[],
    cikSymbols: ReadonlyMap<number, readonly string[]>,
    state: RunState
): Promise<{ form144: Form144Row[]; offerings: OfferingFilingRow[] }> {
    const jobs = plans.map(plan => toJob(deps, plan, cikSymbols));
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
