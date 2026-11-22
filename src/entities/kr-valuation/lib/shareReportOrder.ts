import type { KrReportCode } from '../model';

/**
 * 주식수를 읽을 보고서 순서. 분기보고서(1·3분기)는 주식의 총수 표를 싣지 않으므로(모든 줄이 `-`) 표를 싣는 가장 가까운 보고서를 찾는다:
 * 3분기는 그 해 반기 → 전년 사업보고서, 1분기는 반기가 아직 없으니 전년 사업보고서.
 */
export function shareReportOrder(
    year: number,
    reportCode: KrReportCode
): { year: number; reportCode: KrReportCode }[] {
    switch (reportCode) {
        case '11011':
            return [
                { year, reportCode: '11011' },
                { year: year - 1, reportCode: '11011' },
            ];
        case '11012':
        case '11014':
            return [
                { year, reportCode: '11012' },
                { year: year - 1, reportCode: '11011' },
            ];
        case '11013':
            return [{ year: year - 1, reportCode: '11011' }];
    }
}
