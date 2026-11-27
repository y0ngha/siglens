import type { KrReportCode } from '../model';

/**
 * 주식수를 읽을 보고서 순서 — **보고서 자신의 표가 먼저**다. 1·3분기 보고서도 주식의 총수 표를 채워 내는 회사가 있고(2026 실측: 표본 54개 중
 * 3분기 15개·1분기 16개) 그 표가 결산일 기준으로 가장 정확하다. 표를 비워(모든 줄 `-`) 내는 회사는 표를 싣는 가장 가까운 앞선 보고서로
 * 내려간다: 3분기는 그 해 반기 → 전년 사업보고서, 1분기는 반기가 아직 없으니 전년 사업보고서. 첫 항목이 아닌 곳에서 찾은 표는
 * 결산일이 보고서 기간 말보다 앞서므로 호출부가 KRX 상장주식수로 갱신한다.
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
            return [
                { year, reportCode: '11012' },
                { year: year - 1, reportCode: '11011' },
            ];
        case '11014':
            return [
                { year, reportCode: '11014' },
                { year, reportCode: '11012' },
                { year: year - 1, reportCode: '11011' },
            ];
        case '11013':
            return [
                { year, reportCode: '11013' },
                { year: year - 1, reportCode: '11011' },
            ];
    }
}
