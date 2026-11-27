import 'server-only';
import { normalizeAccession } from '@/entities/company-filings/lib/normalizeAccession';
import {
    listCompanyFilings,
    readCompanyFiling,
} from '@/entities/company-filings/server/getCompanyFilings';
import {
    COMPANY_FILINGS_RESULT_MAX_CHARS,
    fitToEscapedBudget,
} from '@/features/agent-tools/lib/truncate';
import type { ToolExecutor } from '@/features/agent-tools/model';

const SOURCE = 'SEC EDGAR';

/**
 * 읽기 결과가 상한을 넘을 때 본문을 줄여 `truncated: true`로 돌려준다. 상한은 실측 최악(12,000자 본문)에
 * 여유를 둔 값이라 보통 닿지 않지만, 따옴표·줄바꿈이 유난히 많은 본문은 JSON 이스케이프로 더 길어져 닿을 수
 * 있다 — 그때 레지스트리의 일반 절단에 맡기면 결과 전체가 앞부분 미리보기 덩어리로 무너진다.
 */
function fitReadResult<
    T extends { filing: { text: string; truncated: boolean } },
>(result: T): T {
    const overflow =
        JSON.stringify(result).length - COMPANY_FILINGS_RESULT_MAX_CHARS;
    if (overflow <= 0) return result;
    const { text } = result.filing;
    const escapedBudget = JSON.stringify(text).length - 2 - overflow;
    return {
        ...result,
        filing: {
            ...result.filing,
            text: fitToEscapedBudget(text, escapedBudget),
            truncated: true,
        },
    };
}

/**
 * 미국 상장사가 SEC에 낸 최근 현재보고서(8-K·6-K)의 목록, 또는 접수번호 하나의 원문.
 *
 * `accession`이 없거나 문자열이 아니거나 공백이면 목록, 있으면 본문이다. 본문 읽기 횟수(턴당 상한)는 core가 센다 — 여기서 세지
 * 않는다. 한국 종목·크립토는 `no_sec_filer`, SEC·DB 실패와 미국 종목인데 CIK 맵에 없는 경우는 `provider_failed`이며 예외 메시지는
 * 결과에 싣지 않는다(엔티티가 이름·코드만 로그로 남긴다).
 */
export const getCompanyFilingsTool: ToolExecutor = async args => {
    const symbol = String(args.symbol).toUpperCase();
    const rawAccession =
        typeof args.accession === 'string' ? args.accession.trim() : '';
    const asOf = new Date().toISOString();

    if (rawAccession === '') {
        const listed = await listCompanyFilings(symbol);
        if (listed.status === 'no_sec_filer')
            return { symbol, available: false, reason: 'no_sec_filer' };
        if (listed.status === 'failed')
            return { symbol, available: false, reason: 'provider_failed' };
        return {
            asOf,
            source: SOURCE,
            symbol,
            available: true,
            filings: listed.filings,
        };
    }

    const accession = normalizeAccession(rawAccession);
    if (accession === null) return { error: 'unknown_filing' };
    const read = await readCompanyFiling(symbol, accession);
    if (read.status === 'unknown_filing') return { error: 'unknown_filing' };
    if (read.status === 'no_sec_filer')
        return { symbol, available: false, reason: 'no_sec_filer' };
    if (read.status === 'failed')
        return { symbol, available: false, reason: 'provider_failed' };
    return fitReadResult({
        asOf,
        source: SOURCE,
        symbol,
        available: true,
        filing: read.filing,
    });
};
