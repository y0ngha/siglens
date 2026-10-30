import { streamXmlElements } from '@/shared/lib/streamXmlElements';
import {
    findAmendmentsToReapply,
    planPositionApplication,
    type AmendmentFiling,
} from '../lib/amendmentPlan';
import { INVESTOR_FLOWS_MAX_REAPPLY } from '../lib/investorFlowsPolicy';
import {
    parseSec13fPrimaryDoc,
    pickSec13fDocuments,
    type Sec13fDocumentNames,
} from '../lib/sec13fFiling';
import {
    filingSkipReason,
    isReingestReplaceCandidate,
} from '../lib/sec13fIngestPlan';
import { PositionAccumulator } from '../lib/sec13fPositions';
import type { FilingPositions, Sec13fFilingMeta } from '../model';
import type { ReapplyAmendment } from '../api/apply13fFiling';
import type { InvestorFlowsUniverse } from '../api/investorFlowsUniverseRepository';
import { DeadlineSignal } from './ingest13fRunState';
import type { FilingTarget, Ingest13fDeps } from './ingest13fTypes';

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

/** information table 하나를 스트리밍으로 읽어 유니버스 포지션(주식 + 옵션)만 모은다. */
async function readPositions(
    deps: Ingest13fDeps,
    cik: string,
    accession: string,
    infoTable: string | null,
    universe: InvestorFlowsUniverse
): Promise<FilingPositions> {
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
    return accumulator.toPositions();
}

const cusipIdsOf = (universe: InvestorFlowsUniverse): Map<string, number> =>
    new Map([...universe.cusips].map(([cusip, { id }]) => [cusip, id]));

/**
 * 교체(RESTATEMENT)가 포지션을 지우므로, 이미 반영돼 있던 **나중** NEW HOLDINGS(순서가 뒤집힌 경우)를 다시 얹어야
 * 한다. 그 포지션을 **트랜잭션 전에 전부 내려받아** 둔다 — 내려받다가(SEC 차단·타임아웃·마감) 실패하면 교체 자체를 하지
 * 않으므로 교체만 커밋되고 나중 정정이 영영 사라지는 일이 없다. 마감이 지났으면 `DeadlineSignal`을 던진다.
 */
async function downloadLaterAmendments(
    deps: Ingest13fDeps,
    filing: FilingTarget,
    universe: InvestorFlowsUniverse,
    later: readonly AmendmentFiling[]
): Promise<ReapplyAmendment[]> {
    if (later.length > INVESTOR_FLOWS_MAX_REAPPLY) {
        throw new Error(
            `too many later amendments to re-apply (${later.length})`
        );
    }
    const reapply: ReapplyAmendment[] = [];
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
            ...(await readPositions(
                deps,
                filing.cik,
                amendment.accession,
                amendmentDocs.infoTable,
                universe
            )),
        });
    }
    return reapply;
}

/**
 * 제출 하나를 처리한다. 반영되면 dirty가 같은 트랜잭션에 남는다. 실패는 던진다 — 호출부가 원장에 기록한다.
 * 보존 범위 밖·통지·단위가 다른 옛 분기는 포지션 없이 "처리됨"만 기록한다(다시 보지 않게).
 */
export async function processFiling(
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

    if (filingSkipReason(meta.period, meta.reportType, floor) !== null) {
        await repo.applyFiling({
            ...base,
            mode: 'skip',
            rows: [],
            optionRows: [],
        });
        return;
    }

    // 정보테이블 다운로드(SEC)와 기존 원장 조회(DB)는 서로 독립이라 함께 띄운다.
    const [positions, existing] = await Promise.all([
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
    const planned = planPositionApplication(incoming, existing);
    // 재수집 감지: 원장(처리된 제출)은 비었는데 포지션이 이미 있다 = `reingest-13f`가 원장을 지운 뒤다. 원본은 `merge`(같은 값
    // upsert, 새 CUSIP 행만 추가)로 반영한다(`isReingestReplaceCandidate`).
    const mode =
        isReingestReplaceCandidate(planned, filing.formType, existing) &&
        (await repo.hasPositions(filing.cik, meta.period))
            ? 'merge'
            : planned;

    // 교체와 재반영은 **한 트랜잭션**에서 적용한다(`downloadLaterAmendments`).
    const reapply =
        mode === 'replace'
            ? await downloadLaterAmendments(
                  deps,
                  filing,
                  universe,
                  findAmendmentsToReapply(incoming, existing)
              )
            : [];

    await repo.applyFiling({
        ...base,
        mode,
        rows: positions.rows,
        optionRows: positions.optionRows,
        reapply,
        firstForPeriod:
            mode !== 'skip' &&
            !existing.some(f => f.accession !== filing.accession),
    });
}
