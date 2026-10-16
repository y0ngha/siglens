import type {
    InvestorFlowsDataProvider,
    InvestorFlowsSnapshot,
} from '@y0ngha/siglens-core';
import { kstDateKey } from '@/shared/lib/etTimeUtils';
import type {
    DartInsiderReportRecord,
    DartMajorHoldingRecord,
    DartTradingPlanRecord,
} from '../api/investorFlowsDartRepository';
import { krSymbolToStockCode } from '../lib/dartSymbol';
import { addDays } from '../lib/investorFlowsDates';
import { INVESTOR_FLOWS_DART_RETENTION_DAYS } from '../lib/investorFlowsPolicy';
import { assembleKrInvestorFlowsSnapshot } from '../lib/krInvestorFlowsSnapshot';
import type { DartCorpRecord } from '../model';

/** KR 스냅샷이 읽는 DART 테이블(`DrizzleInvestorFlowsDartRepository`의 읽기 메서드). */
export interface KrInvestorFlowsSnapshotReads {
    resolveCorpCode(stockCode: string): Promise<DartCorpRecord | null>;
    findMajorHoldings(
        corpCode: string,
        sinceDate: string
    ): Promise<DartMajorHoldingRecord[]>;
    findInsiderReports(
        corpCode: string,
        sinceDate: string
    ): Promise<DartInsiderReportRecord[]>;
    findTradingPlans(
        corpCode: string,
        sinceDate: string
    ): Promise<DartTradingPlanRecord[]>;
}

export interface KrInvestorFlowsSnapshotDeps {
    reads: KrInvestorFlowsSnapshotReads;
    now: () => Date;
    log: (message: string, detail?: unknown) => void;
}

/**
 * 한국 종목의 수급 스냅샷 — **DB의 DART 테이블만** 읽는다(설계 §4.2·§4.5). 화면·에이전트·공개 API가 DART·FMP·SEC·FINRA를 직접
 * 부르면 봇 크롤과 API 이용이 할당량을 쓰므로, 원천 호출은 `dart-filings` cron에만 있다.
 *
 * - 심볼 → 단축코드 → 고유번호(우선주는 보통주 코드로, `resolveCorpCode`). 매핑이 없으면 `null`("데이터 없음", 탭은 열림).
 * - 창은 보존 기간과 같은 2년(KST 달력). core는 그 안에서 90일 창으로 채점한다.
 * - 발행주식수는 DB에 한국 원천이 없어 `null`이다 — 소유보고의 순증감은 core가 보유비율 증감 합으로 잰다.
 *
 * 인프라 실패(DB 오류)는 그대로 던진다 — resilient 로더가 degrade로 바꾼다("데이터 없음"으로 위장하지 않는다).
 */
export async function loadKrInvestorFlowsSnapshot(
    symbol: string,
    deps: KrInvestorFlowsSnapshotDeps
): Promise<InvestorFlowsSnapshot | null> {
    const stockCode = krSymbolToStockCode(symbol);
    if (stockCode === null) return null;
    const corp = await deps.reads.resolveCorpCode(stockCode);
    if (corp === null) return null;
    const today = kstDateKey(deps.now());
    const since = addDays(today, -INVESTOR_FLOWS_DART_RETENTION_DAYS);
    const [majorHoldings, insiderReports, tradingPlans] = await Promise.all([
        deps.reads.findMajorHoldings(corp.corpCode, since),
        deps.reads.findInsiderReports(corp.corpCode, since),
        deps.reads.findTradingPlans(corp.corpCode, since),
    ]);
    const { snapshot, droppedRows } = assembleKrInvestorFlowsSnapshot({
        asOf: today,
        majorHoldings,
        insiderReports,
        tradingPlans,
        sharesOutstanding: null,
    });
    if (droppedRows > 0) {
        deps.log(
            `[investor-flows] ${symbol}: ${droppedRows} DART rows without quantities left out of the snapshot`
        );
    }
    return snapshot;
}

/** 한국 종목용 `InvestorFlowsDataProvider` 포트 구현. 실제 의존은 `getInvestorFlowsDataProvider`가 구성한다. */
export class DbDartInvestorFlowsDataProvider implements InvestorFlowsDataProvider {
    constructor(private readonly deps: KrInvestorFlowsSnapshotDeps) {}

    getInvestorFlowsSnapshot(
        symbol: string
    ): Promise<InvestorFlowsSnapshot | null> {
        return loadKrInvestorFlowsSnapshot(symbol, this.deps);
    }
}
