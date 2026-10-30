import type {
    DartDisclosureDetailType,
    DartListPage,
} from '@/shared/api/dart/dartClient';
import type { DartListCursor } from '../lib/dartIngestState';
import {
    REFETCH_TRIGGER_TYPES,
    TRADING_PLAN_TYPE,
    latestReceiptDate,
    overflowResume,
    scanStart,
} from '../lib/dartIngestPlan';
import {
    disclosureMatchesDetailType,
    parseDisclosureListRows,
    toTradingPlanRow,
} from '../lib/dartParsers';
import { INVESTOR_FLOWS_DART_MAX_LIST_PAGES } from '../lib/investorFlowsPolicy';
import type { DartDisclosureListRow, DartTradingPlanRow } from '../model';
import { canCall, errorMessage, stopOnFatal } from './dartRunContext';
import type { RunContext } from './ingestDartFilingsTypes';

/** `scanDisclosures`의 결과 — 재조회할 회사, 저장할 거래계획보고서, 어디까지 읽었는지. */
export interface ScanOutcome {
    /** 멈춤 없이 세 유형을 다 읽었다(넘침은 멈춤이 아니다). */
    complete: boolean;
    changedCorps: Set<string>;
    plans: DartTradingPlanRow[];
    /** D005가 페이지 상한에 걸렸을 때 다음 실행이 D005를 다시 읽기 시작할 날짜. 끝까지 읽었으면 null. */
    tradingPlansFrom: string | null;
}

type ScanStatus = 'complete' | 'overflow' | 'stopped';

/** 상세 유형 하나를 읽은 결과 — 유니버스 회사의 공시 행과, 어디서 멈췄는지. */
interface DetailTypeScan {
    detailType: DartDisclosureDetailType;
    status: ScanStatus;
    rows: DartDisclosureListRow[];
    /** 읽은 행(유니버스 밖 포함) 중 가장 늦은 접수일 — 넘쳤을 때 다음 실행의 재개 지점. 읽은 행이 없으면 null. */
    lastReceiptDate: string | null;
}

/**
 * 상세 유형 하나를 `from`~오늘 끝까지 페이지로 읽어 유니버스 회사의 행을 돌려준다. 페이지 상한
 * (`INVESTOR_FLOWS_DART_MAX_LIST_PAGES`)을 넘는 창이면 `overflow`로 알린다(호출부가 대응한다). 도중에 멈추면(`stopped`) 그때까지
 * 읽은 행도 돌려준다.
 */
async function scanDetailType(
    ctx: RunContext,
    detailType: DartDisclosureDetailType,
    from: string
): Promise<DetailTypeScan> {
    // 페이지 루프의 진행 기록(누적 행·페이지 번호) — 다음 페이지가 앞 페이지의 `total_page`에 달려 있어 순차 루프다.
    const rows: DartDisclosureListRow[] = [];
    let pageNo = 1;
    let lastReceiptDate: string | null = null;
    const done = (status: ScanStatus): DetailTypeScan => ({
        detailType,
        status,
        rows,
        lastReceiptDate,
    });
    for (;;) {
        if (!canCall(ctx, 1)) return done('stopped');
        ctx.calls += 1;
        let page: DartListPage;
        try {
            page = await ctx.deps.dart.fetchDisclosureList({
                beginDate: from,
                endDate: ctx.today,
                detailType,
                pageNo,
            });
        } catch (error) {
            if (!stopOnFatal(ctx, error)) {
                ctx.deps.log(
                    `[dart-filings] list ${detailType} page ${pageNo} failed:`,
                    errorMessage(error)
                );
            }
            return done('stopped');
        }
        ctx.result.listPages += 1;
        const parsed = parseDisclosureListRows(page.rows);
        ctx.result.skippedRows += parsed.skipped;
        const matching = parsed.rows.filter(row =>
            disclosureMatchesDetailType(detailType, row.title)
        );
        const mismatched = parsed.rows.length - matching.length;
        if (mismatched > 0) {
            ctx.result.mismatchedRows += mismatched;
            ctx.deps.log(
                `[dart-filings] list ${detailType} page ${pageNo} returned ${mismatched} rows of another report type — dropped (is the detail-type filter being ignored?)`
            );
        }
        // 재개 지점은 버린 행까지 포함한 응답의 마지막 접수일 — 오래된 순 정렬이라 페이지 끝이 가장 늦다.
        lastReceiptDate = latestReceiptDate(parsed.rows, lastReceiptDate);
        rows.push(
            ...matching.filter(row => ctx.universeCorps.has(row.corpCode))
        );
        if (pageNo >= page.totalPage) return done('complete');
        if (pageNo >= INVESTOR_FLOWS_DART_MAX_LIST_PAGES)
            return done('overflow');
        pageNo += 1;
    }
}

/**
 * 공시검색으로 커서~오늘의 D001·D002(재조회할 회사)와 D005(거래계획보고서 행)를 모은다. 하나라도 끝까지 못 읽으면
 * `complete: false` — 커서를 옮기지 않아 다음 실행이 같은 창을 다시 읽는다(멱등).
 *
 * D001·D002 창이 페이지 상한을 넘으면(장기 중단 뒤) 목록으로 회사를 고르는 대신 **유니버스 전체**를 대기열에 넣는다 — 그 창의
 * 변동을 모두 담는 가장 싼 방법이 회사별 전체 이력 재조회다. D005가 넘치면 상한까지의 행을 저장하고, 읽은 마지막 접수일을
 * `tradingPlansFrom`으로 돌려 다음 실행이 거기서 잇게 한다(커서를 오늘로 넘기면 그 사이 거래계획보고서를 잃는다).
 */
export async function scanDisclosures(
    ctx: RunContext,
    cursor: DartListCursor
): Promise<ScanOutcome> {
    // 유형은 차례로 — 호출 상한·데드라인을 같은 순서로 소비하고, 한 유형이 멈추면 뒤 유형은 읽지 않는다.
    const scans: DetailTypeScan[] = [];
    let tradingPlansFrom: string | null = null;
    for (const detailType of [...REFETCH_TRIGGER_TYPES, TRADING_PLAN_TYPE]) {
        const from = scanStart(cursor, detailType, ctx.today);
        const scan = await scanDetailType(ctx, detailType, from);
        scans.push(scan);
        if (scan.status === 'stopped') break;
        if (scan.status === 'overflow') {
            if (detailType === TRADING_PLAN_TYPE) {
                const resume = overflowResume(scan.lastReceiptDate, from);
                if (resume.daySaturated) {
                    // `DART_DAY_OVERFLOW`는 운영 로그 검색·알람용 고정 표식이다(그날 나머지 공시를 잃는 유일한 경로).
                    ctx.deps.log(
                        `[dart-filings] DART_DAY_OVERFLOW list ${scan.detailType} fills ${INVESTOR_FLOWS_DART_MAX_LIST_PAGES} pages on ${from} alone — skipping the rest of that day`
                    );
                }
                tradingPlansFrom = resume.date;
            }
            ctx.deps.log(
                `[dart-filings] list ${detailType} exceeds ${INVESTOR_FLOWS_DART_MAX_LIST_PAGES} pages since ${from}` +
                    (detailType === TRADING_PLAN_TYPE
                        ? ` — storing the first pages, next run resumes from ${tradingPlansFrom}`
                        : ' — queueing the whole universe for a full refetch')
            );
        }
    }
    const refetchScans = scans.filter(
        scan => scan.detailType !== TRADING_PLAN_TYPE
    );
    return {
        complete: scans.every(scan => scan.status !== 'stopped'),
        changedCorps: new Set(
            refetchScans.flatMap(scan =>
                scan.status === 'overflow'
                    ? ctx.universe.corpCodes
                    : scan.rows.map(row => row.corpCode)
            )
        ),
        plans: scans
            .filter(scan => scan.detailType === TRADING_PLAN_TYPE)
            .flatMap(scan => scan.rows.map(toTradingPlanRow)),
        tradingPlansFrom,
    };
}
