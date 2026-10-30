/**
 * 한국 대량보유 표의 행 — 최신 접수일 순 행마다 같은 보고자의 직전 보고 대비 보유비율 증감(%p)을 한 번씩 계산해 붙인다.
 */
import type { KrMajorHolderReport } from '@y0ngha/siglens-core';
import { majorHolderRatioChange } from '@/entities/investor-flows/lib/krMajorHolderRatioChange';
import { newestKrRows } from './krDisclosures';
import type { LimitedRows } from './secFilings';

/** 표 한 행 — 보고와, 같은 보고자의 직전 보고 대비 증감. */
export interface MajorHolderRowData {
    readonly row: KrMajorHolderReport;
    /** 최초 보고라 계산할 수 없으면 `null` — DART 증감은 최초 보고에서 보유비율 전체라 그대로 쓰면 틀린다. */
    readonly ratioChangePct: number | null;
}

/**
 * 표에 싣는 행과 상한 밖으로 빠진 건수. 증감은 상한과 무관하게 **전체 보고**에서 직전 보고를 찾아 구한다 — 표에서 잘린 옛
 * 보고도 비교 대상이다.
 */
export function buildMajorHolderRows(
    reports: readonly KrMajorHolderReport[]
): LimitedRows<MajorHolderRowData> {
    const { rows, omittedCount } = newestKrRows(reports);
    return {
        rows: rows.map(row => ({
            row,
            ratioChangePct: majorHolderRatioChange(row, reports),
        })),
        omittedCount,
    };
}
