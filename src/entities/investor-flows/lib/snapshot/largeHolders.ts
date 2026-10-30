import type { LargeHolderFiling } from '@y0ngha/siglens-core';
import type { RawBeneficialOwnership } from '@/shared/api/fmp/investorFlowsProvider.types';
import { addDays, compareIsoDate } from '../investorFlowsDates';
import { finiteNumber, isIsoDate } from './snapshotRows';

/** 스냅샷 `largeHolders`에 담는 13D/G 신고 수 상한(최신순). */
export const SNAPSHOT_MAX_LARGE_HOLDERS = 60;

/** 13D/G는 약 2년치만 담는다(core 계약). */
export const LARGE_HOLDER_WINDOW_DAYS = 730;

/**
 * **대체 경로 전용** — SEC 제출 목록 조회가 실패했을 때만 5% 대량보유 공시의 양식을 URL에서 추정한다(정상
 * 경로는 `RawBeneficialOwnership.form`의 정확한 값이다). 새 EDGAR 형식(`xslSCHEDULE_13G_X02`)과 옛 파일명
 * (`sc13ga.htm`)은 `13D`/`13G` 토큰을 담지만 **정정(`/A`) 여부는 알 수 없어** 붙이지 않는다. 토큰이 없으면
 * `unknown`(core는 이런 행을 건너뛴다).
 */
export function inferLargeHolderForm(url: string | null | undefined): string {
    if (!url) return 'unknown';
    if (/13d/i.test(url)) return 'SC 13D';
    if (/13g/i.test(url)) return 'SC 13G';
    return 'unknown';
}

/** FMP 13D/G 원본 → core 대량보유 신고. `today` 기준 `LARGE_HOLDER_WINDOW_DAYS` 밖의 행은 버린다. */
export function buildLargeHolders(
    rows: readonly RawBeneficialOwnership[],
    today: string
): LargeHolderFiling[] {
    const cutoff = addDays(today, -LARGE_HOLDER_WINDOW_DAYS);
    return rows
        .flatMap((row): LargeHolderFiling[] => {
            if (
                !isIsoDate(row.filingDate) ||
                row.filingDate.slice(0, 10) < cutoff
            ) {
                return [];
            }
            return [
                {
                    filingDate: row.filingDate.slice(0, 10),
                    filer: row.nameOfReportingPerson ?? '',
                    form:
                        row.form ??
                        (row.formLookupFailed
                            ? inferLargeHolderForm(row.url)
                            : 'unknown'),
                    percentOfClass: finiteNumber(row.percentOfClass),
                    shares: finiteNumber(row.amountBeneficiallyOwned),
                    url: row.url ?? '',
                },
            ];
        })
        .sort((a, b) => compareIsoDate(b.filingDate, a.filingDate))
        .slice(0, SNAPSHOT_MAX_LARGE_HOLDERS);
}
