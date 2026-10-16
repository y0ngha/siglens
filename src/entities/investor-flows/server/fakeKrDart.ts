import type { InvestorFlowsSnapshot } from '@y0ngha/siglens-core';
import { buildFakeDartData } from '@/shared/api/dart/fakeDartClient';
import { KR_SHORT_CODE_RE } from '@/shared/config/ticker';
import { kstDateKey } from '@/shared/lib/etTimeUtils';
import {
    parseDisclosureListRows,
    parseExecutiveStockRows,
    parseMajorStockRows,
    toTradingPlanRow,
} from '../lib/dartParsers';
import { krSymbolToStockCode, resolveDartCorp } from '../lib/dartSymbol';
import { assembleKrInvestorFlowsSnapshot } from '../lib/krInvestorFlowsSnapshot';
import type { DartCorpRecord } from '../model';

/**
 * E2E·테스트용 한국 수급 — 가짜 DART 응답(`buildFakeDartData`)을 **수집기와 같은 파서**(`parseMajorStockRows` 등)와 같은 매핑
 * (`resolveDartCorp`)·스냅샷 조립(`assembleKrInvestorFlowsSnapshot`)에 통과시킨다. 손으로 만든 core 스냅샷을 쓰면 원천 형식
 * (쉼표 수량·`-`·두 날짜 형식) → 저장 행 → core 타입 매핑이 검증되지 않는다. DB·네트워크를 쓰지 않는다.
 */

/** 심볼 → 가짜 `dart_corp_code` 조회 결과. 우선주(`005935.KS`)는 보통주 코드로 찾는다. */
export function resolveFakeDartCorp(
    symbol: string,
    now: Date
): DartCorpRecord | null {
    const stockCode = krSymbolToStockCode(symbol);
    if (stockCode === null) return null;
    // 비상장 법인(`stock_code` 공백)은 수집기도 맵에 넣지 않는다(`parseCorpCodeXml`).
    const listed = buildFakeDartData(now).corpCodes.filter(row =>
        KR_SHORT_CODE_RE.test(row.stockCode)
    );
    const match = resolveDartCorp(
        stockCode,
        new Map(listed.map(row => [row.stockCode, row.corpCode]))
    );
    const corpName = listed.find(
        row => row.stockCode === match?.matchedStockCode
    )?.corpName;
    return match === null || corpName === undefined
        ? null
        : { ...match, corpName };
}

/** 가짜 DART 데이터로 만든 한국 스냅샷. 매핑이 없거나 공시가 하나도 없으면 `null`(진짜 provider와 같다). */
export function buildFakeKrSnapshot(
    symbol: string,
    now: Date
): InvestorFlowsSnapshot | null {
    const corp = resolveFakeDartCorp(symbol, now);
    if (corp === null) return null;
    const data = buildFakeDartData(now);
    const { corpCode } = corp;
    return assembleKrInvestorFlowsSnapshot({
        asOf: kstDateKey(now),
        majorHoldings: parseMajorStockRows(
            data.majorStock[corpCode] ?? [],
            corpCode
        ).rows,
        insiderReports: parseExecutiveStockRows(
            data.executiveStock[corpCode] ?? [],
            corpCode
        ).rows,
        tradingPlans: parseDisclosureListRows(data.disclosures.D005 ?? [])
            .rows.filter(row => row.corpCode === corpCode)
            .map(toTradingPlanRow),
        sharesOutstanding: null,
    }).snapshot;
}
