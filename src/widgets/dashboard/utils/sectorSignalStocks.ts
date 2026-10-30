/**
 * 섹터 신호 종목을 화면에 그리는 집합으로 거르고 사분면에 나누는 순수 헬퍼.
 * 패널과 SSR 요약이 같은 집합을 보도록 이 파이프라인을 함께 쓴다.
 */
import type {
    ConflictResolution,
    QuadrantKey,
    StockSignalResult,
    StockWithConflict,
} from '@y0ngha/siglens-core';
import {
    EMPTY_QUADRANTS,
    filterStrictAnticipation,
    groupStockIntoQuadrants,
} from '@/entities/analysis/lib/quadrants';
import { resolveConflicts } from '@/entities/analysis/lib/resolveConflicts';

/** 섹터 하나의 화면 구성 — 확정/조짐 4사분면과 방향이 엇갈린 종목. */
export interface SectorSignalView {
    quadrants: Record<QuadrantKey, readonly StockWithConflict[]>;
    mixedStocks: readonly StockWithConflict[];
}

/**
 * 패널이 실제로 그리는 종목 집합.
 *
 * 추세와 어긋난 예상 신호를 먼저 걷어내고(`filterStrictAnticipation`) 상충 신호를
 * 정리한다(`resolveConflicts`). 두 단계 모두 종목 단위라 섹터로 먼저 거르든 나중에
 * 거르든 결과가 같다.
 */
export function resolveDisplayedStocks(
    stocks: readonly StockSignalResult[]
): ConflictResolution {
    return resolveConflicts(filterStrictAnticipation(stocks));
}

/** 패널에 보이는 종목 전체 — 정리된 종목과 방향이 엇갈린 종목을 합친다. */
export function listDisplayedStocks(
    stocks: readonly StockSignalResult[]
): readonly StockSignalResult[] {
    const { resolved, mixed } = resolveDisplayedStocks(stocks);
    return [...resolved, ...mixed];
}

/** 선택한 섹터의 종목을 화면 구성(사분면 + 혼재)으로 나눈다. */
export function buildSectorSignalView(
    stocks: readonly StockSignalResult[],
    sectorSymbol: string
): SectorSignalView {
    const { resolved, mixed } = resolveDisplayedStocks(
        stocks.filter(stock => stock.sectorSymbol === sectorSymbol)
    );
    return {
        quadrants: resolved.reduce(groupStockIntoQuadrants, EMPTY_QUADRANTS),
        mixedStocks: mixed,
    };
}

/** 섹터에 보여 줄 종목이 하나도 없는가. */
export function isSectorViewEmpty(view: SectorSignalView): boolean {
    return (
        view.mixedStocks.length === 0 &&
        Object.values(view.quadrants).every(stocks => stocks.length === 0)
    );
}

/**
 * 패널이 위에서 아래로 그리는 소절 순서. 본문과 자리 표시가 같은 목록을 쓰므로 소절이
 * 늘거나 줄면 둘이 함께 바뀐다.
 */
export const SUBSECTION_IDS = [
    'bullishConfirmed',
    'bullishExpected',
    'mixed',
    'bearishExpected',
    'bearishConfirmed',
] as const;

/** 소절 식별자. */
export type SubsectionId = (typeof SUBSECTION_IDS)[number];

/** 소절별 종목 수. */
export type SubsectionCounts = Record<SubsectionId, number>;

/** 다섯 소절에 각각 몇 종목이 보이는가. */
export function countSubsectionStocks(
    view: SectorSignalView
): SubsectionCounts {
    return {
        bullishConfirmed: view.quadrants.bullishConfirmed.length,
        bullishExpected: view.quadrants.bullishExpected.length,
        mixed: view.mixedStocks.length,
        bearishExpected: view.quadrants.bearishExpected.length,
        bearishConfirmed: view.quadrants.bearishConfirmed.length,
    };
}
